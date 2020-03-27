package command

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/plugin"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

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
	context         *plugin.Context
	args            *model.CommandArgs
	pluginAPI       *pluginapi.Client
	logger          bot.Logger
	poster          bot.Poster
	incidentService incident.Service
}

// NewCommandRunner creates a command runner.
func NewCommandRunner(ctx *plugin.Context, args *model.CommandArgs, api *pluginapi.Client,
	logger bot.Logger, poster bot.Poster, incidentService incident.Service) *Runner {
	return &Runner{
		context:         ctx,
		args:            args,
		pluginAPI:       api,
		logger:          logger,
		poster:          poster,
		incidentService: incidentService,
	}
}

func (r *Runner) isValid() error {
	if r.context == nil || r.args == nil || r.pluginAPI == nil {
		return errors.New("invalid arguments to command.Runner")
	}
	return nil
}

func (r *Runner) postCommandResponse(text string) {
	r.poster.Ephemeral(r.args.UserId, r.args.ChannelId, "%s", text)
}

func (r *Runner) actionDialogStart(args []string) {
	postID := ""
	if len(args) > 0 {
		postID = args[0]
	}

	if err := r.IncidentService.CreateIncidentDialog(r.Args.UserId, r.Args.TriggerId, postID); err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", err))
		return
	}
}

func (r *Runner) actionEnd() {
	incident, err := r.incidentService.EndIncident(r.args.ChannelId)

	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", err))
		return
	}

	user, err := r.pluginAPI.User.Get(r.args.UserId)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", err))
		return
	}

	// Post that @user has ended the incident.
	if err := r.poster.PostMessage(r.args.ChannelId, "%v has been closed by @%v", incident.Name, user.Username); err != nil {
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
		r.actionDialogStart(parameters)
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
