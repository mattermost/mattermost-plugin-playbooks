package command

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/permissions"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/plugin"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-server/v5/model"
)

const helpText = "###### Mattermost Incident Response Plugin - Slash Command Help\n" +
	"* `/incident start` - Start a new incident. \n" +
	"* `/incident end` - Close the incident of that channel. \n" +
	"* `/incident check [checklist #] [item #]` - check/uncheck the checklist item. \n" +
	"* `/incident commander [@username]` - Show or change the current commander. \n" +
	"* `/incident announce ~[channels]` - Announce the current incident in other channels. \n" +
	"* `/incident list` - List all your incidents. \n" +
	"* `/incident info` - Show a summary of the current incident. \n" +
	"\n" +
	"Learn more [in our documentation](https://mattermost.com/pl/default-incident-response-app-documentation). \n" +
	""

const confirmPrompt = "CONFIRM"

// Register is a function that allows the runner to register commands with the mattermost server.
type Register func(*model.Command) error

// RegisterCommands should be called by the plugin to register all necessary commands
func RegisterCommands(registerFunc Register) error {
	return registerFunc(getCommand())
}

func getCommand() *model.Command {
	return &model.Command{
		Trigger:          "incident",
		DisplayName:      "Incident",
		Description:      "Incident Response Plugin",
		AutoComplete:     true,
		AutoCompleteDesc: "Available commands: start, end, restart, check, announce, list, commander, info",
		AutoCompleteHint: "[command]",
		AutocompleteData: getAutocompleteData(),
	}
}

func getAutocompleteData() *model.AutocompleteData {
	slashIncident := model.NewAutocompleteData("incident", "[command]",
		"Available commands: start, end, restart, check, announce, list, commander")

	start := model.NewAutocompleteData("start", "", "Starts a new incident")
	slashIncident.AddCommand(start)

	end := model.NewAutocompleteData("end", "",
		"Ends the incident associated with the current channel")
	slashIncident.AddCommand(end)

	restart := model.NewAutocompleteData("restart", "",
		"Restarts the incident associated with the current channel")
	slashIncident.AddCommand(restart)

	checklist := model.NewAutocompleteData("check", "[checklist item]",
		"Checks or unchecks a checklist item.")
	checklist.AddDynamicListArgument(
		"List of checklist items is downloading from your incident response plugin",
		"api/v1/incidents/checklist-autocomplete", true)
	slashIncident.AddCommand(checklist)

	announce := model.NewAutocompleteData("announce", "~[channels]",
		"Announce the current incident in other channels.")
	announce.AddNamedTextArgument("channel",
		"Channel to announce incident in", "~[channel]", "", true)
	slashIncident.AddCommand(announce)

	list := model.NewAutocompleteData("list", "", "Lists all your incidents")
	slashIncident.AddCommand(list)

	commander := model.NewAutocompleteData("commander", "[@username]",
		"Show or change the current commander")
	commander.AddTextArgument("The desired new commander.", "[@username]", "")
	slashIncident.AddCommand(commander)

	info := model.NewAutocompleteData("info", "", "Shows a summary of the current incident")
	slashIncident.AddCommand(info)

	return slashIncident
}

// Runner handles commands.
type Runner struct {
	context         *plugin.Context
	args            *model.CommandArgs
	pluginAPI       *pluginapi.Client
	logger          bot.Logger
	poster          bot.Poster
	incidentService incident.Service
	playbookService playbook.Service
}

// NewCommandRunner creates a command runner.
func NewCommandRunner(ctx *plugin.Context, args *model.CommandArgs, api *pluginapi.Client,
	logger bot.Logger, poster bot.Poster, incidentService incident.Service, playbookService playbook.Service) *Runner {
	return &Runner{
		context:         ctx,
		args:            args,
		pluginAPI:       api,
		logger:          logger,
		poster:          poster,
		incidentService: incidentService,
		playbookService: playbookService,
	}
}

func (r *Runner) isValid() error {
	if r.context == nil || r.args == nil || r.pluginAPI == nil {
		return errors.New("invalid arguments to command.Runner")
	}
	return nil
}

func (r *Runner) postCommandResponse(text string) {
	post := &model.Post{
		Message: text,
	}
	r.poster.EphemeralPost(r.args.UserId, r.args.ChannelId, post)
}

func (r *Runner) warnUserAndLogErrorf(format string, args ...interface{}) {
	r.logger.Errorf(format, args...)
	r.poster.EphemeralPost(r.args.UserId, r.args.ChannelId, &model.Post{
		Message: "Your request could not be completed. Check the system logs for more information.",
	})
}

func (r *Runner) actionStart(args []string) {
	clientID := ""
	if len(args) > 0 {
		clientID = args[0]
	}

	postID := ""
	if len(args) == 2 {
		postID = args[1]
	}

	if !permissions.CanViewTeam(r.args.UserId, r.args.TeamId, r.pluginAPI) {
		r.postCommandResponse("Must be a member of the team to start incidents.")
		return
	}

	requesterInfo := playbook.RequesterInfo{
		UserID:          r.args.UserId,
		TeamID:          r.args.TeamId,
		UserIDtoIsAdmin: map[string]bool{r.args.UserId: permissions.IsAdmin(r.args.UserId, r.pluginAPI)},
		MemberOnly:      true,
	}

	playbooksResults, err := r.playbookService.GetPlaybooksForTeam(requesterInfo, r.args.TeamId,
		playbook.Options{
			Sort:      playbook.SortByTitle,
			Direction: playbook.OrderAsc,
		})
	if err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}

	if err := r.incidentService.OpenCreateIncidentDialog(r.args.TeamId, r.args.UserId, r.args.TriggerId, postID, clientID, playbooksResults.Items); err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}
}

func (r *Runner) actionCheck(args []string) {
	if len(args) != 2 {
		r.postCommandResponse(helpText)
		return
	}

	checklist, err := strconv.Atoi(args[0])
	if err != nil {
		r.postCommandResponse("Error parsing the first argument. Must be a number.")
		return
	}

	item, err := strconv.Atoi(args[1])
	if err != nil {
		r.postCommandResponse("Error parsing the second argument. Must be a number.")
		return
	}

	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if err != nil {
		if errors.Is(err, incident.ErrNotFound) {
			r.postCommandResponse("You can only check/uncheck an item from within the incident's channel.")
			return
		}
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	err = r.incidentService.ToggleCheckedState(incidentID, r.args.UserId, checklist, item)
	if err != nil {
		r.warnUserAndLogErrorf("Error checking/unchecking item: %v", err)
	}
}

func (r *Runner) actionCommander(args []string) {
	switch len(args) {
	case 0:
		r.actionShowCommander(args)
	case 1:
		r.actionChangeCommander(args)
	default:
		r.postCommandResponse("/incident commander expects at most one argument.")
	}
}

func (r *Runner) actionShowCommander([]string) {
	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if errors.Is(err, incident.ErrNotFound) {
		r.postCommandResponse("You can only show the commander from within the incident's channel.")
		return
	} else if err != nil {
		r.warnUserAndLogErrorf("Error retrieving incident for channel %s: %v", r.args.ChannelId, err)
		return
	}

	currentIncident, err := r.incidentService.GetIncident(incidentID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	commanderUser, err := r.pluginAPI.User.Get(currentIncident.CommanderUserID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving commander user: %v", err)
		return
	}

	r.postCommandResponse(fmt.Sprintf("**@%s** is the current commander for this incident.", commanderUser.Username))
}

func (r *Runner) actionChangeCommander(args []string) {
	targetCommanderUsername := strings.TrimLeft(args[0], "@")

	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if errors.Is(err, incident.ErrNotFound) {
		r.postCommandResponse("You can only change the commander from within the incident's channel.")
		return
	} else if err != nil {
		r.warnUserAndLogErrorf("Error retrieving incident for channel %s: %v", r.args.ChannelId, err)
		return
	}

	currentIncident, err := r.incidentService.GetIncident(incidentID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	targetCommanderUser, err := r.pluginAPI.User.GetByUsername(targetCommanderUsername)
	if errors.Is(err, pluginapi.ErrNotFound) {
		r.postCommandResponse(fmt.Sprintf("Unable to find user @%s", targetCommanderUsername))
		return
	} else if err != nil {
		r.warnUserAndLogErrorf("Error finding user @%s: %v", targetCommanderUsername, err)
		return
	}

	if currentIncident.CommanderUserID == targetCommanderUser.Id {
		r.postCommandResponse(fmt.Sprintf("User @%s is already commander of this incident.", targetCommanderUsername))
		return
	}

	_, err = r.pluginAPI.Channel.GetMember(r.args.ChannelId, targetCommanderUser.Id)
	if errors.Is(err, pluginapi.ErrNotFound) {
		r.postCommandResponse(fmt.Sprintf("User @%s must be part of this channel to make them commander.", targetCommanderUsername))
		return
	} else if err != nil {
		r.warnUserAndLogErrorf("Failed to find user @%s as channel member: %v", targetCommanderUsername, err)
		return
	}

	err = r.incidentService.ChangeCommander(currentIncident.ID, r.args.UserId, targetCommanderUser.Id)
	if err != nil {
		r.warnUserAndLogErrorf("Failed to change commander to @%s: %v", targetCommanderUsername, err)
		return
	}
}

func (r *Runner) actionAnnounce(args []string) {
	if len(args) < 1 {
		r.postCommandResponse(helpText)
		return
	}

	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if err != nil {
		if errors.Is(err, incident.ErrNotFound) {
			r.postCommandResponse("You can only announce from within the incident's channel.")
			return
		}
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	currentIncident, err := r.incidentService.GetIncident(incidentID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	commanderUser, err := r.pluginAPI.User.Get(currentIncident.CommanderUserID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving commander user: %v", err)
		return
	}

	incidentChannel, err := r.pluginAPI.Channel.Get(currentIncident.ChannelID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving incident channel: %v", err)
		return
	}

	for _, channelarg := range args {
		if err := r.announceChannel(strings.TrimPrefix(channelarg, "~"), commanderUser.Username, incidentChannel.Name); err != nil {
			r.postCommandResponse("Error announcing to: " + channelarg)
		}
	}
}

func (r *Runner) actionList() {
	team, err := r.pluginAPI.Team.Get(r.args.TeamId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving current team: %v", err)
		return
	}

	requesterInfo := incident.RequesterInfo{
		UserID:          r.args.UserId,
		UserIDtoIsAdmin: map[string]bool{r.args.UserId: permissions.IsAdmin(r.args.UserId, r.pluginAPI)},
	}

	options := incident.HeaderFilterOptions{
		TeamID:   r.args.TeamId,
		MemberID: r.args.UserId,
		PerPage:  10,
		Sort:     incident.SortByCreateAt,
		Order:    incident.OrderDesc,
		Status:   incident.Ongoing,
	}

	result, err := r.incidentService.GetIncidents(requesterInfo, options)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving the incidents: %v", err)
		return
	}

	message := "Ongoing Incidents in **" + team.DisplayName + "** Team:\n"
	if len(result.Items) == 0 {
		message = "There are no ongoing incidents in **" + team.DisplayName + "** team."
	}

	now := time.Now()
	attachments := make([]*model.SlackAttachment, len(result.Items))
	for i, theIncident := range result.Items {
		commander, err := r.pluginAPI.User.Get(theIncident.CommanderUserID)
		if err != nil {
			r.warnUserAndLogErrorf("Error retrieving commander of incident '%s': %v", theIncident.Name, err)
			return
		}

		channel, err := r.pluginAPI.Channel.Get(theIncident.ChannelID)
		if err != nil {
			r.warnUserAndLogErrorf("Error retrieving channel of incident '%s': %v", theIncident.Name, err)
			return
		}

		attachments[i] = &model.SlackAttachment{
			Pretext: fmt.Sprintf("### ~%s", channel.Name),
			Fields: []*model.SlackAttachmentField{
				{Title: "Stage:", Value: fmt.Sprintf("**%s**", theIncident.ActiveStageTitle)},
				{Title: "Duration:", Value: durationString(getTimeForMillis(theIncident.CreateAt), now)},
				{Title: "Commander:", Value: fmt.Sprintf("@%s", commander.Username)},
			},
		}
	}

	post := &model.Post{
		Message: message,
		Props: map[string]interface{}{
			"attachments": attachments,
		},
	}
	r.poster.EphemeralPost(r.args.UserId, r.args.ChannelId, post)
}

func (r *Runner) actionInfo() {
	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if errors.Is(err, incident.ErrNotFound) {
		r.postCommandResponse("You can only show the details of an incident from within the incident's channel.")
		return
	} else if err != nil {
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	session, err := r.pluginAPI.Session.Get(r.context.SessionId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving session: %v", err)
		return
	}

	if !session.IsMobileApp() {
		// The RHS was opened by the webapp, so inform the user
		r.postCommandResponse("Your incident details are already open in the right hand side of the channel.")
		return
	}

	theIncident, err := r.incidentService.GetIncident(incidentID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	commander, err := r.pluginAPI.User.Get(theIncident.CommanderUserID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving commander user: %v", err)
		return
	}

	if theIncident.ActiveStage >= len(theIncident.Checklists) {
		r.warnUserAndLogErrorf("Error retrieving current checklist: active stage is %d and the incident has %d checklists", theIncident.ActiveStage, len(theIncident.Checklists))
		return
	}

	activeChecklist := theIncident.Checklists[theIncident.ActiveStage]

	tasks := ""
	for _, item := range activeChecklist.Items {
		icon := ":white_large_square: "
		timestamp := ""
		if item.State == playbook.ChecklistItemStateClosed {
			icon = ":white_check_mark: "
			timestamp = " (" + getTimeForMillis(item.StateModified).Format("15:04 PM") + ")"
		}

		tasks += icon + item.Title + timestamp + "\n"
	}
	attachment := &model.SlackAttachment{
		Fields: []*model.SlackAttachmentField{
			{Title: "Incident Name:", Value: fmt.Sprintf("**%s**", strings.Trim(theIncident.Name, " "))},
			{Title: "Duration:", Value: durationString(getTimeForMillis(theIncident.CreateAt), time.Now())},
			{Title: "Commander:", Value: fmt.Sprintf("@%s", commander.Username)},
			{Title: "Stage:", Value: activeChecklist.Title},
			{Title: "Tasks:", Value: tasks},
		},
	}

	post := &model.Post{
		Props: map[string]interface{}{
			"attachments": []*model.SlackAttachment{attachment},
		},
	}
	r.poster.EphemeralPost(r.args.UserId, r.args.ChannelId, post)
}

func getTimeForMillis(unixMillis int64) time.Time {
	return time.Unix(0, unixMillis*int64(1000000))
}

func durationString(start, end time.Time) string {
	duration := end.Sub(start).Round(time.Second)

	durationStr := duration.String()

	if duration.Hours() > 23 {
		days := duration / (24 * time.Hour)
		duration %= 24 * time.Hour

		durationStr = fmt.Sprintf("%dd%s", days, duration.String())
	}

	return durationStr
}

func (r *Runner) announceChannel(targetChannelName, commanderUsername, incidentChannelName string) error {
	targetChannel, err := r.pluginAPI.Channel.GetByName(r.args.TeamId, targetChannelName, false)
	if err != nil {
		return err
	}

	if _, err := r.poster.PostMessage(targetChannel.Id, "@%v started an incident in ~%v", commanderUsername, incidentChannelName); err != nil {
		return err
	}

	return nil
}

func (r *Runner) actionEnd() {
	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if err != nil {
		if errors.Is(err, incident.ErrNotFound) {
			r.postCommandResponse("You can only end an incident from within the incident's channel.")
			return
		}
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	if err = permissions.EditIncident(r.args.UserId, incidentID, r.pluginAPI, r.incidentService); err != nil {
		if errors.Is(err, permissions.ErrNoPermissions) {
			r.postCommandResponse(fmt.Sprintf("userID `%s` is not an admin or channel member", r.args.UserId))
			return
		}
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	err = r.incidentService.OpenEndIncidentDialog(incidentID, r.args.TriggerId)

	switch {
	case errors.Is(err, incident.ErrIncidentNotActive):
		r.postCommandResponse("This incident has already been closed.")
		return
	case err != nil:
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}
}

func (r *Runner) actionRestart() {
	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if err != nil {
		if errors.Is(err, incident.ErrNotFound) {
			r.postCommandResponse("You can only restart an incident from within the incident's channel.")
			return
		}
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	if err = permissions.EditIncident(r.args.UserId, incidentID, r.pluginAPI, r.incidentService); err != nil {
		if errors.Is(err, permissions.ErrNoPermissions) {
			r.postCommandResponse(fmt.Sprintf("userID `%s` is not an admin or channel member", r.args.UserId))
			return
		}
		r.warnUserAndLogErrorf("Error retrieving incident: %v", err)
		return
	}

	err = r.incidentService.RestartIncident(incidentID, r.args.UserId)

	switch {
	case errors.Is(err, incident.ErrNotFound):
		r.postCommandResponse("This channel is not associated with an incident.")
		return
	case errors.Is(err, incident.ErrIncidentActive):
		r.postCommandResponse("This incident is already active.")
		return
	case err != nil:
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}
}

func (r *Runner) actionSelftest(args []string) {
	if r.pluginAPI.Configuration.GetConfig().ServiceSettings.EnableTesting == nil ||
		!*r.pluginAPI.Configuration.GetConfig().ServiceSettings.EnableTesting {
		r.postCommandResponse(helpText)
		return
	}

	if !r.pluginAPI.User.HasPermissionTo(r.args.UserId, model.PERMISSION_MANAGE_SYSTEM) {
		r.postCommandResponse("Running the self-test is restricted to system administrators.")
		return
	}

	if len(args) != 2 || args[0] != confirmPrompt || args[1] != "SELF-TEST" {
		r.postCommandResponse("Are you sure you want to self-test (which will nuke the database and delete all data -- instances, configuration)? " +
			"All incident data will be lost. To self-test, type `/incident st CONFIRM SELF-TEST`")
		return
	}

	if err := r.incidentService.NukeDB(); err != nil {
		r.postCommandResponse("There was an error while nuking db. Err: " + err.Error())
		return
	}

	shortDescription := "A short description."
	longDescription := `A very long description describing the item in a very descriptive way. Now with Markdown syntax! We have *italics* and **bold**. We have [external](http://example.com) and [internal links](/ad-1/com.mattermost.plugin-incident-response/playbooks). We have even links to channels: ~town-square. And links to users: @sysadmin, @user-1. We do have the usual headings and lists, of course:
## Unordered List
- One
- Two
- Three

### Ordered List
1. One
2. Two
3. Three

We also have images:

![Mattermost logo](/static/icon_152x152.png)

And... yes, of course, we have emojis

:muscle: :sunglasses: :tada: :confetti_ball: :balloon: :cowboy_hat_face: :nail_care:`

	testPlaybook := playbook.Playbook{
		Title:  "testing playbook",
		TeamID: r.args.TeamId,
		Checklists: []playbook.Checklist{
			{
				Title: "Identification",
				Items: []playbook.ChecklistItem{
					{
						Title:       "Create Jira ticket",
						Description: longDescription,
					},
					{
						Title: "Add on-call team members",
						State: playbook.ChecklistItemStateClosed,
					},
					{
						Title:       "Identify blast radius",
						Description: shortDescription,
					},
					{
						Title: "Identify impacted services",
					},
					{
						Title: "Collect server data logs",
					},
					{
						Title: "Identify blast Analyze data logs",
					},
				},
			},
			{
				Title: "Resolution",
				Items: []playbook.ChecklistItem{
					{
						Title: "Align on plan of attack",
					},
					{
						Title: "Confirm resolution",
					},
				},
			},
			{
				Title: "Analysis",
				Items: []playbook.ChecklistItem{
					{
						Title: "Writeup root-cause analysis",
					},
					{
						Title: "Review post-mortem",
					},
				},
			},
		},
	}
	playbookID, err := r.playbookService.Create(testPlaybook)
	if err != nil {
		r.postCommandResponse("There was an error while creating playbook. Err: " + err.Error())
		return
	}

	gotplaybook, err := r.playbookService.Get(playbookID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("There was an error while retrieving playbook. ID: %v Err: %v", playbookID, err.Error()))
		return
	}

	if gotplaybook.Title != testPlaybook.Title {
		r.postCommandResponse(fmt.Sprintf("Retrieved playbook is wrong, ID: %v Playbook: %+v", playbookID, gotplaybook))
		return
	}

	if gotplaybook.ID == "" {
		r.postCommandResponse("Retrieved playbook has a blank ID")
		return
	}

	gotPlaybooks, err := r.playbookService.GetPlaybooks()
	if err != nil {
		r.postCommandResponse("There was an error while retrieving all playbooks. Err: " + err.Error())
		return
	}

	if len(gotPlaybooks) != 1 || gotPlaybooks[0].Title != testPlaybook.Title {
		r.postCommandResponse(fmt.Sprintf("Retrieved playbooks are wrong: %+v", gotPlaybooks))
		return
	}

	gotplaybook.Title = "This is an updated title"
	if err = r.playbookService.Update(gotplaybook); err != nil {
		r.postCommandResponse("Unable to update playbook Err:" + err.Error())
		return
	}

	gotupdated, err := r.playbookService.Get(playbookID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("There was an error while retrieving playbook. ID: %v Err: %v", playbookID, err.Error()))
		return
	}

	if gotupdated.Title != gotplaybook.Title {
		r.postCommandResponse("Update was ineffective")
		return
	}

	todeleteid, err := r.playbookService.Create(testPlaybook)
	if err != nil {
		r.postCommandResponse("There was an error while creating playbook. Err: " + err.Error())
		return
	}
	testPlaybook.ID = todeleteid
	if err = r.playbookService.Delete(testPlaybook); err != nil {
		r.postCommandResponse("There was an error while deleting playbook. Err: " + err.Error())
		return
	}

	if deletedPlaybook, _ := r.playbookService.Get(todeleteid); deletedPlaybook.Title != "" {
		r.postCommandResponse("Playbook should have been vaporized! Where's the kaboom? There was supposed to be an earth-shattering Kaboom!")
		return
	}

	createdIncident, err := r.incidentService.CreateIncident(&incident.Incident{
		Header: incident.Header{
			Name:            "Cloud Incident 4739",
			TeamID:          r.args.TeamId,
			CommanderUserID: r.args.UserId,
		},
		PlaybookID: gotplaybook.ID,
		Checklists: gotplaybook.Checklists,
	}, true)
	if err != nil {
		r.postCommandResponse("Unable to create test incident: " + err.Error())
		return
	}

	if err := r.incidentService.AddChecklistItem(createdIncident.ID, r.args.UserId, 0, playbook.ChecklistItem{
		Title: "I should be checked and second",
	}); err != nil {
		r.postCommandResponse("Unable to add checklist item: " + err.Error())
		return
	}

	if err := r.incidentService.AddChecklistItem(createdIncident.ID, r.args.UserId, 0, playbook.ChecklistItem{
		Title: "I should be deleted",
	}); err != nil {
		r.postCommandResponse("Unable to add checklist item: " + err.Error())
		return
	}

	if err := r.incidentService.AddChecklistItem(createdIncident.ID, r.args.UserId, 0, playbook.ChecklistItem{
		Title: "I should not say this.",
		State: playbook.ChecklistItemStateClosed,
	}); err != nil {
		r.postCommandResponse("Unable to add checklist item: " + err.Error())
		return
	}

	if err := r.incidentService.ModifyCheckedState(createdIncident.ID, r.args.UserId, playbook.ChecklistItemStateClosed, 0, 0); err != nil {
		r.postCommandResponse("Unable to modify checked state: " + err.Error())
		return
	}

	if err := r.incidentService.ModifyCheckedState(createdIncident.ID, r.args.UserId, playbook.ChecklistItemStateOpen, 0, 2); err != nil {
		r.postCommandResponse("Unable to modify checked state: " + err.Error())
		return
	}

	if err := r.incidentService.RemoveChecklistItem(createdIncident.ID, r.args.UserId, 0, 1); err != nil {
		r.postCommandResponse("Unable to remove checklist item: " + err.Error())
		return
	}

	if err := r.incidentService.RenameChecklistItem(createdIncident.ID, r.args.UserId, 0, 1,
		"I should say this! and be unchecked and first!", ""); err != nil {
		r.postCommandResponse("Unable to remove checklist item: " + err.Error())
		return
	}

	if err := r.incidentService.MoveChecklistItem(createdIncident.ID, r.args.UserId, 0, 0, 1); err != nil {
		r.postCommandResponse("Unable to remove checklist item: " + err.Error())
		return
	}

	r.postCommandResponse("Self test success.")
}

func (r *Runner) actionNukeDB(args []string) {
	if r.pluginAPI.Configuration.GetConfig().ServiceSettings.EnableTesting == nil ||
		!*r.pluginAPI.Configuration.GetConfig().ServiceSettings.EnableTesting {
		r.postCommandResponse(helpText)
		return
	}

	if !r.pluginAPI.User.HasPermissionTo(r.args.UserId, model.PERMISSION_MANAGE_SYSTEM) {
		r.postCommandResponse("Nuking the database is restricted to system administrators.")
		return
	}

	if len(args) != 2 || args[0] != "CONFIRM" || args[1] != "NUKE" {
		r.postCommandResponse("Are you sure you want to nuke the database (delete all data -- instances, configuration)?" +
			"All incident data will be lost. To nuke database, type `/incident nuke-db CONFIRM NUKE`")
		return
	}

	if err := r.incidentService.NukeDB(); err != nil {
		r.postCommandResponse("There was an error while nuking db. Please contact your system administrator.")
	}
	r.postCommandResponse("DB has been reset.")
}

// Execute should be called by the plugin when a command invocation is received from the Mattermost server.
func (r *Runner) Execute() error {
	if err := r.isValid(); err != nil {
		return err
	}

	split := strings.Fields(r.args.Command)
	command := split[0]
	parameters := []string{}
	cmd := ""
	if len(split) > 1 {
		cmd = split[1]
	}
	if len(split) > 2 {
		parameters = split[2:]
	}

	if command != "/incident" {
		return nil
	}

	switch cmd {
	case "start":
		r.actionStart(parameters)
	case "end":
		r.actionEnd()
	case "check":
		r.actionCheck(parameters)
	case "restart":
		r.actionRestart()
	case "commander":
		r.actionCommander(parameters)
	case "announce":
		r.actionAnnounce(parameters)
	case "list":
		r.actionList()
	case "info":
		r.actionInfo()
	case "nuke-db":
		r.actionNukeDB(parameters)
	case "st":
		r.actionSelftest(parameters)
	default:
		r.postCommandResponse(helpText)
	}

	return nil
}
