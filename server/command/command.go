package command

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/plugin"

	pluginApi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const helpText = "###### Mattermost Incident Response Plugin - Slash Command Help\n" +
	"* `/incident start` - Start a new incident. \n" +
	"* `/incident end` - Close the incident of that channel. \n" +
	"\n" +
	"Learn more [in our documentation](https://mattermost.com/pl/default-incident-response-app-documentation). \n" +
	""

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
		AutoCompleteDesc: "Available commands: start, end",
		AutoCompleteHint: "[command]",
	}
}

// Runner handles commands.
type Runner struct {
	Context         *plugin.Context
	Args            *model.CommandArgs
	PluginAPI       *pluginApi.Client
	Logger          bot.Logger
	Poster          bot.Poster
	IncidentService incident.Service
}

// NewCommandRunner creates a command runner.
func NewCommandRunner(ctx *plugin.Context, args *model.CommandArgs, api *pluginApi.Client,
	logger bot.Logger, poster bot.Poster, incidentService incident.Service) *Runner {
	return &Runner{
		Context:         ctx,
		Args:            args,
		PluginAPI:       api,
		Logger:          logger,
		Poster:          poster,
		IncidentService: incidentService,
	}
}

func (r *Runner) isValid() error {
	if r.Context == nil || r.Args == nil || r.PluginAPI == nil {
		return errors.New("invalid arguments to command.Runner")
	}
	return nil
}

func (r *Runner) postCommandResponse(text string) {
	r.Poster.Ephemeral(r.Args.UserId, r.Args.ChannelId, "%s", text)
}

func (r *Runner) actionStart() {
	incident, err := r.IncidentService.CreateIncident(&incident.Incident{
		Header: incident.Header{
			CommanderUserID: r.Args.UserId,
			TeamID:          r.Args.TeamId,
		},
	})
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", err))
		return
	}

	team, err := r.PluginAPI.Team.Get(incident.TeamID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", errors.Wrapf(err, "failed to get team %s", incident.TeamID)))
		return
	}

	channel, err := r.PluginAPI.Channel.Get(incident.ChannelIDs[0])
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", errors.Wrapf(err, "failed to get channel %s", incident.TeamID)))
		return
	}

	url := r.PluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	msg := fmt.Sprintf("Incident started -> [~%s](%s)", incident.Name, fmt.Sprintf("%s/%s/channels/%s", *url, team.Name, channel.Name))
	r.postCommandResponse(msg)
}

func (r *Runner) actionEnd() {
	incident, err := r.IncidentService.EndIncident(r.Args.ChannelId)

	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", err))
		return
	}

	user, err := r.PluginAPI.User.Get(r.Args.UserId)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", err))
		return
	}

	// Post that @user has ended the incident.
	if err := r.Poster.PostMessage(r.Args.ChannelId, "%v has been closed by @%v", incident.Name, user.Username); err != nil {
		r.postCommandResponse(fmt.Sprintf("Failed to post message to incident channel: %v", err))
		return
	}
}

func (r *Runner) actionNukeDB(args []string) {
	if len(args) != 2 || args[0] != "CONFIRM" || args[1] != "NUKE" {
		r.postCommandResponse("Are you sure you want to nuke the database (delete all data -- instances, configuration)?" +
			"All incident data will be lost. To nuke database, type `/incident nuke-db CONFIRM NUKE`")
		return
	}

	if err := r.IncidentService.NukeDB(); err != nil {
		r.postCommandResponse("There was an error while nuking db. Please contact your system administrator.")
	}
	r.postCommandResponse("DB has been reset.")
}

// Execute should be called by the plugin when a command invocation is received from the Mattermost server.
func (r *Runner) Execute() error {
	if err := r.isValid(); err != nil {
		return err
	}

	split := strings.Fields(r.Args.Command)
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
		r.actionStart()
	case "end":
		r.actionEnd()
	case "stop":
		r.actionEnd()
	case "nuke-db":
		r.actionNukeDB(parameters)
	default:
		r.postCommandResponse(helpText)
	}

	return nil
}
