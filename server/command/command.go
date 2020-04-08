package command

import (
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/plugin"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-server/v5/model"
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
	r.poster.Ephemeral(r.args.UserId, r.args.ChannelId, "%s", text)
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

	if err := r.incidentService.OpenCreateIncidentDialog(r.args.UserId, r.args.TriggerId, postID, clientID); err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", err))
		return
	}
}

func (r *Runner) actionEnd() {
	incidentID := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if !r.incidentService.IsCommander(incidentID, r.args.UserId) {
		r.postCommandResponse("Only the commander may end an incident.")
		return
	}

	err := r.incidentService.OpenEndIncidentDialog(incidentID, r.args.TriggerId)

	if errors.Is(err, incident.ErrNotFound) {
		r.postCommandResponse("This channel is not associated with an incident.")
		return
	} else if errors.Is(err, incident.ErrIncidentNotActive) {
		r.postCommandResponse("This incident has already been closed.")
		return
	} else if err != nil {
		r.postCommandResponse(fmt.Sprintf("Error: %v", err))
		return
	}
}

func (r *Runner) actionSelftest() {
	if err := r.incidentService.NukeDB(); err != nil {
		r.postCommandResponse("There was an error while nuking db. Err: " + err.Error())
		return
	}

	testPlaybook := playbook.Playbook{
		Title: "testing playbook",
		Checklists: []playbook.Checklist{
			{
				Title: "Team A",
				Items: []playbook.ChecklistItem{
					{
						Title: "Alert the correct people",
					},
					{
						Title: "Answer stupid questions",
					},
					{
						Title: "Solve the problem",
					},
				},
			},
			{
				Title: "Team B",
				Items: []playbook.ChecklistItem{
					{
						Title: "Panic",
					},
					{
						Title: "Ask stupid questions",
					},
					{
						Title: "Panic",
					},
					{
						Title: "Tell everone else to not panic",
					},
					{
						Title: "Panic",
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
		r.postCommandResponse(fmt.Sprintf("Retrieved playbook has a blank ID"))
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
		r.postCommandResponse(fmt.Sprintf("Unable to update playbook Err:" + err.Error()))
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
	if err = r.playbookService.Delete(todeleteid); err != nil {
		r.postCommandResponse("There was an error while deleteing playbook. Err: " + err.Error())
		return
	}

	if deletedPlaybook, _ := r.playbookService.Get(todeleteid); deletedPlaybook.Title != "" {
		r.postCommandResponse("Playbook should have been vaporised! Where's the kaboom? There was supposed to be an earth-shattering Kaboom!")
		return
	}

	if _, err := r.incidentService.CreateIncident(&incident.Incident{
		Header: incident.Header{
			Name:            "Test - " + model.NewId(),
			TeamID:          r.args.TeamId,
			CommanderUserID: r.args.UserId,
		},
		Playbook: gotplaybook,
	}); err != nil {
		r.postCommandResponse("Unable to create test incident: " + err.Error())
		return
	}

	r.postCommandResponse("Self test success.")
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
		r.actionStart(parameters)
	case "end":
		r.actionEnd()
	case "nuke-db":
		r.actionNukeDB(parameters)
	//TODO: Disable in production
	case "st":
		r.actionSelftest()
	default:
		r.postCommandResponse(helpText)
	}

	return nil
}
