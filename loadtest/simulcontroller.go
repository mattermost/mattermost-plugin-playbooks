package loadtest

import (
	"context"
	"fmt"

	"github.com/blang/semver"
	ltcontrol "github.com/mattermost/mattermost-load-test-ng/loadtest/control"
	ltplugins "github.com/mattermost/mattermost-load-test-ng/loadtest/plugins"
	ltuser "github.com/mattermost/mattermost-load-test-ng/loadtest/user"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

// SimulController is a load-test controller for the Playbooks plugin, to be
// injected in the load-test tool's SimulController tests.
// It implements the [ltplugins.Plugin] interface
type SimulController struct {
	store *PluginStore
}

// OpenRHS opens the Playbooks RHS, getting the channel's runs to show either
// the whole list or a single one.
func (c *SimulController) OpenRHS(u ltuser.User, pbClient *client.Client) ltcontrol.UserActionResponse {
	ctx := context.Background()

	// Retrieve current channel
	currentChannel, err := u.Store().CurrentChannel()
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}
	channelID := currentChannel.Id
	teamID := currentChannel.TeamId

	// 1. Get in progress runs and store them
	runsInProgress, err := gqlRHSRuns(pbClient, channelID, client.SortByCreateAt, client.SortDesc, client.StatusInProgress, 8, "")
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}
	err = c.store.SetRuns(runsInProgress)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 2. Get finished runs and store them
	runsFinished, err := gqlRHSRuns(pbClient, channelID, client.SortByCreateAt, client.SortDesc, client.StatusFinished, 8, "")
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}
	err = c.store.SetRuns(runsFinished)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 3. Retrieve the list of playbooks in the team and store them
	playbooks, err := pbClient.Playbooks.List(ctx, teamID, 0, 10, client.PlaybookListOptions{
		Sort:         client.SortByTitle,
		Direction:    client.SortAsc,
		SearchTeam:   "",
		WithArchived: false,
	})
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}
	err = c.store.SetPlaybooks(playbooks.Items)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// We only continue if there is exactly one in progress run, which the RHS
	// list directly shows. In any other case, we return early
	if runsInProgress.TotalCount != 1 {
		msg := fmt.Sprintf("RHS open with %d in-progress and %d finished runs", runsInProgress.TotalCount, runsFinished.TotalCount)
		return ltcontrol.UserActionResponse{Info: msg}
	}
	graphqlRun := runsInProgress.Edges[0].Node

	// 4. Retrieve the details of the run
	currentRun, err := pbClient.PlaybookRuns.Get(ctx, graphqlRun.Id)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 5. Retrieve the run's metadata
	// https://hub.mattermost.com/plugins/playbooks/api/v0/runs/fuhegiurtbb75fnfajaka98uuo/metadata
	_, err = pbClient.PlaybookRuns.GetMetadata(ctx, currentRun.ID)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 6. If the run is attached to a playbook, retrieve the whole playbook
	if currentRun.PlaybookID != "" {
		_, err = pbClient.Playbooks.Get(ctx, currentRun.PlaybookID)
		if err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}
	}

	// 7. Check whether the current run is marked as favourite
	_, err = pbClient.Categories.IsFavorite(ctx, client.CategoriesIsFavoriteOptions{
		TeamId:   teamID,
		ItemId:   currentRun.ID,
		ItemType: "r",
	})
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// 8. Retrieve, again, the run's metadata.
	// TODO: This mimics the current behaviour of the playbook, but this looks
	// like a frontend bug to me
	_, err = pbClient.PlaybookRuns.GetMetadata(ctx, currentRun.ID)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	msg := fmt.Sprintf("RHS open with in-progress run %q", currentRun.Name)
	return ltcontrol.UserActionResponse{Info: msg}
}

// PluginId returns the ID of the Playbooks plugin.
//
//nolint:staticcheck
func (c *SimulController) PluginId() string {
	return "playbooks"
}

// MinServerVersion returns the minimum version the Mattermost server must have
// to be able to run the registered actions.
func (c *SimulController) MinServerVersion() semver.Version {
	return semver.MustParse("11.0.0")
}

// wrapAction is a wrapper to translate between (User -> UserActionResponse)
// functions and ((User, Client) -> UserActionResponse) functions
// It is used to initialize the Playbooks client with the provided user's client,
// so that the current authorization and permissions are synced.
func wrapAction(action func(u ltuser.User, pbClient *client.Client) ltcontrol.UserActionResponse) func(u ltuser.User) ltcontrol.UserActionResponse {
	return func(u ltuser.User) ltcontrol.UserActionResponse {
		pbClient, err := client.New(u.Client())
		if err != nil {
			return ltcontrol.UserActionResponse{Err: fmt.Errorf("error creating playbooks client: %w", err)}
		}

		return action(u, pbClient)
	}

}

// Actions returns a list of all the registered actions implemented by Playbooks.
func (c *SimulController) Actions() []ltplugins.PluginAction {
	return []ltplugins.PluginAction{
		{
			Name:      "OpenRHS",
			Run:       wrapAction(c.OpenRHS),
			Frequency: 1.0,
		},
	}
}

// ClearUserData resets the underlying store to clear all previously stored data.
func (c *SimulController) ClearUserData() {
	c.store.Clear()
}

// RunHook is the entry point for running all hooks: it is in charge of
// converting the payload into the corresponding struct for each hook type, and
// running it.
func (c *SimulController) RunHook(hookType ltplugins.HookType, u ltuser.User, payload any) error {
	switch hookType {
	case ltplugins.HookLogin:
		// There is no payload expected for this hook
		return c.HookLogin(u)
	case ltplugins.HookSwitchTeam:
		p, ok := payload.(ltplugins.HookPayloadSwitchTeam)
		if !ok {
			return fmt.Errorf("unable to decode payload %v into HookPayloadSwitchTeam struct", payload)
		}
		return c.HookSwitchTeam(u, p.TeamId)
	case ltplugins.HookSwitchChannel:
		p, ok := payload.(ltplugins.HookPayloadSwitchChannel)
		if !ok {
			return fmt.Errorf("unable to decode payload %v into HookPayloadSwitchChannel struct", payload)
		}
		return c.HookSwitchChannel(u, p.ChannelId)
	default:
		// Any other hook is not implemented, so running this should be a no-op
		return nil
	}
}

// HookLogin implements the logic performed by Playbooks right after the user
// has logged in.
func (c *SimulController) HookLogin(u ltuser.User) error {
	pbClient, err := client.New(u.Client())
	if err != nil {
		return err
	}

	ctx := context.Background()

	// Get and store settings
	settings, err := pbClient.Settings.Get(ctx)
	if err != nil {
		return nil
	}
	c.store.SetSettings(settings)

	// Connect the bot
	return pbClient.Bot.Connect(ctx)
}

// HookSwitchTeam implements the logic performed by Playbooks right after the
// user has switched to another team.
func (c *SimulController) HookSwitchTeam(u ltuser.User, teamID string) error {
	pbClient, err := client.New(u.Client())
	if err != nil {
		return err
	}

	runs, err := gqlRunsOnTeam(pbClient, teamID)
	if err != nil {
		return err
	}

	return c.store.SetRunsOnTeam(runs)
}

// HookSwitchChannel implements the logic performed by Playbooks right after the
// user has switched to another channel.
func (c *SimulController) HookSwitchChannel(u ltuser.User, channelID string) error {
	pbClient, err := client.New(u.Client())
	if err != nil {
		return err
	}

	actions, err := pbClient.Actions.List(context.Background(), channelID, client.ChannelActionListOptions{
		TriggerType: client.TriggerTypeNewMemberJoins,
	})
	if err != nil {
		return err
	}

	return c.store.SetActions(channelID, actions)
}
