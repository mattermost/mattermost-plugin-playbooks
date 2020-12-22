package command

import (
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-management/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-management/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-management/server/permissions"
	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-management/server/timeutils"
	"github.com/mattermost/mattermost-server/v5/plugin"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-server/v5/model"
)

const helpText = "###### Mattermost Incident Management Plugin - Slash Command Help\n" +
	"* `/incident start` - Start a new incident. \n" +
	"* `/incident end` - Close the incident of that channel. \n" +
	"* `/incident update` - Update the incident's status and (if enabled) post the status update to the broadcast channel. \n" +
	"* `/incident stage` - Move to the next or previous stage. \n" +
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
func RegisterCommands(registerFunc Register, addTestCommands bool) error {
	return registerFunc(getCommand(addTestCommands))
}

func getCommand(addTestCommands bool) *model.Command {
	return &model.Command{
		Trigger:          "incident",
		DisplayName:      "Incident",
		Description:      "Incident Management Plugin",
		AutoComplete:     true,
		AutoCompleteDesc: "Available commands: start, end, update, stage, restart, check, announce, list, commander, info",
		AutoCompleteHint: "[command]",
		AutocompleteData: getAutocompleteData(addTestCommands),
	}
}

func getAutocompleteData(addTestCommands bool) *model.AutocompleteData {
	slashIncident := model.NewAutocompleteData("incident", "[command]",
		"Available commands: start, end, update, restart, check, announce, list, commander, info, stage")

	start := model.NewAutocompleteData("start", "", "Starts a new incident")
	slashIncident.AddCommand(start)

	end := model.NewAutocompleteData("end", "",
		"Ends the incident associated with the current channel")
	slashIncident.AddCommand(end)

	update := model.NewAutocompleteData("update", "",
		"Update the current incident's status.")
	slashIncident.AddCommand(update)

	next := model.NewAutocompleteData("stage", "[next/prev]", "Move to the next or previous stage")
	next.AddStaticListArgument("", true, []model.AutocompleteListItem{
		{
			Item:     "next",
			HelpText: "Move to next stage",
		},
		{
			Item:     "prev",
			HelpText: "Move to previous stage",
		},
	})
	slashIncident.AddCommand(next)

	restart := model.NewAutocompleteData("restart", "",
		"Restarts the incident associated with the current channel")
	slashIncident.AddCommand(restart)

	checklist := model.NewAutocompleteData("check", "[checklist item]",
		"Checks or unchecks a checklist item.")
	checklist.AddDynamicListArgument(
		"List of checklist items is downloading from your Incident Management plugin",
		"api/v0/incidents/checklist-autocomplete", true)
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

	if addTestCommands {
		test := model.NewAutocompleteData("test", "", "Commands for testing and debugging.")

		testCreate := model.NewAutocompleteData("create-incident", "[playbook ID] [timestamp] [incident name]", "Create an incident with a specific creation date")
		testCreate.AddDynamicListArgument("List of playbooks is downloading from your incident response plugin", "api/v0/playbooks/autocomplete", true)
		testCreate.AddTextArgument("Date in format 2020-01-31", "Creation timestamp", `/[0-9]{4}-[0-9]{2}-[0-9]{2}/`)
		testCreate.AddTextArgument("Name of the incident", "Incident name", "")
		test.AddCommand(testCreate)

		testData := model.NewAutocompleteData("bulk-data", "[ongoing] [ended] [begin] [end] [seed]", "Generate random test data in bulk")
		testData.AddTextArgument("An integer indicating how many ongoing incidents will be generated.", "Number of ongoing incidents", "")
		testData.AddTextArgument("An integer indicating how many ended incidents will be generated.", "Number of ended incidents", "")
		testData.AddTextArgument("Date in format 2020-01-31", "First possible creation date", "")
		testData.AddTextArgument("Date in format 2020-01-31", "Last possible creation date", "")
		testData.AddTextArgument("An integer in case you need random, but reproducible, results", "Random seed (optional)", "")
		test.AddCommand(testData)

		testSelf := model.NewAutocompleteData("self", "", "DESTRUCTIVE ACTION - Perform a series of self tests to ensure everything works as expected.")
		test.AddCommand(testSelf)

		slashIncident.AddCommand(test)
	}

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
			Direction: playbook.DirectionAsc,
		})
	if err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}

	session, err := r.pluginAPI.Session.Get(r.context.SessionId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving session: %v", err)
		return
	}

	if err := r.incidentService.OpenCreateIncidentDialog(r.args.TeamId, r.args.UserId, r.args.TriggerId, postID, clientID, playbooksResults.Items, session.IsMobileApp()); err != nil {
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
		targetChannelName := strings.TrimPrefix(channelarg, "~")
		targetChannel, err := r.pluginAPI.Channel.GetByName(r.args.TeamId, targetChannelName, false)
		if err != nil {
			r.postCommandResponse("Channel not found: " + channelarg)
			continue
		}
		if !permissions.CanPostToChannel(r.args.UserId, targetChannel.Id, r.pluginAPI) {
			r.postCommandResponse("Cannot post to: " + channelarg)
			continue
		}
		if err := r.announceChannel(targetChannel.Id, commanderUser.Username, incidentChannel.Name); err != nil {
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

	session, err := r.pluginAPI.Session.Get(r.context.SessionId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving session: %v", err)
		return
	}

	if !session.IsMobileApp() {
		// The RHS was opened by the webapp, so inform the user
		r.postCommandResponse("The list of your incidents is open in the right hand side of the channel.")
		return
	}

	requesterInfo := incident.RequesterInfo{
		UserID:          r.args.UserId,
		UserIDtoIsAdmin: map[string]bool{r.args.UserId: permissions.IsAdmin(r.args.UserId, r.pluginAPI)},
	}

	options := incident.HeaderFilterOptions{
		TeamID:    r.args.TeamId,
		MemberID:  r.args.UserId,
		PerPage:   10,
		Sort:      incident.SortByCreateAt,
		Direction: incident.DirectionDesc,
		Status:    incident.Ongoing,
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
				{Title: "Duration:", Value: timeutils.DurationString(timeutils.GetTimeForMillis(theIncident.CreateAt), now)},
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
		r.postCommandResponse("You can only see the details of an incident from within the incident's channel.")
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
			timestamp = " (" + timeutils.GetTimeForMillis(item.StateModified).Format("15:04 PM") + ")"
		}

		tasks += icon + item.Title + timestamp + "\n"
	}
	attachment := &model.SlackAttachment{
		Fields: []*model.SlackAttachmentField{
			{Title: "Incident Name:", Value: fmt.Sprintf("**%s**", strings.Trim(theIncident.Name, " "))},
			{Title: "Duration:", Value: timeutils.DurationString(timeutils.GetTimeForMillis(theIncident.CreateAt), time.Now())},
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

func (r *Runner) announceChannel(targetChannelID, commanderUsername, incidentChannelName string) error {
	if _, err := r.poster.PostMessage(targetChannelID, "@%v started an incident in ~%v", commanderUsername, incidentChannelName); err != nil {
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

func (r *Runner) actionUpdate() {
	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if err != nil {
		if errors.Is(err, incident.ErrNotFound) {
			r.postCommandResponse("You can only update an incident from within the incident's channel.")
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

	err = r.incidentService.OpenUpdateStatusDialog(incidentID, r.args.TriggerId)
	switch {
	case errors.Is(err, incident.ErrIncidentNotActive):
		r.postCommandResponse("This incident has already been closed.")
		return
	case err != nil:
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}
}

func (r *Runner) actionStage(args []string) {
	if len(args) != 1 {
		r.postCommandResponse("`/incident stage` expects one argument: either `next` or `prev`")
		return
	}

	switch strings.ToLower(args[0]) {
	case "next":
		r.actionStageNext()
	case "prev":
		r.actionStagePrev()
	default:
		r.postCommandResponse("`/incident stage` expects the argument to be either `next` or `prev`")
	}
}

func (r *Runner) actionStageNext() {
	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if err != nil {
		if errors.Is(err, incident.ErrNotFound) {
			r.postCommandResponse("You can only change an incident stage from within the incident's channel.")
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

	numChecklists := len(currentIncident.Checklists)
	if numChecklists == 0 {
		r.postCommandResponse("The incident contains no stages.")
		return
	}

	if currentIncident.ActiveStage < 0 || currentIncident.ActiveStage >= numChecklists {
		r.warnUserAndLogErrorf("ActiveStage %d is out of bounds: incident '%s' has %d stages", currentIncident.ActiveStage, incidentID, numChecklists)
		return
	}

	if currentIncident.ActiveStage == numChecklists-1 {
		r.postCommandResponse("The active stage is the last one. If you want to end the incident, run `/incident end`")
		return
	}

	allCompleted := true
	for _, item := range currentIncident.Checklists[currentIncident.ActiveStage].Items {
		if item.State == playbook.ChecklistItemStateOpen {
			allCompleted = false
			break
		}
	}

	if !allCompleted {
		err = r.incidentService.OpenNextStageDialog(incidentID, currentIncident.ActiveStage+1, r.args.TriggerId)
		if err != nil {
			r.warnUserAndLogErrorf("Error: %v", err)
		}

		return
	}

	_, err = r.incidentService.ChangeActiveStage(incidentID, r.args.UserId, currentIncident.ActiveStage+1)
	if err != nil {
		r.warnUserAndLogErrorf("Error changing active stage of incident '%s': %v", incidentID, err)
	}
}

func (r *Runner) actionStagePrev() {
	incidentID, err := r.incidentService.GetIncidentIDForChannel(r.args.ChannelId)
	if err != nil {
		if errors.Is(err, incident.ErrNotFound) {
			r.postCommandResponse("You can only change an incident stage from within the incident's channel.")
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

	numChecklists := len(currentIncident.Checklists)
	if numChecklists == 0 {
		r.postCommandResponse("The incident contains no stages.")
		return
	}

	if currentIncident.ActiveStage < 0 || currentIncident.ActiveStage >= numChecklists {
		r.warnUserAndLogErrorf("ActiveStage %d is out of bounds: incident '%s' has %d stages", currentIncident.ActiveStage, incidentID, numChecklists)
		return
	}

	if currentIncident.ActiveStage == 0 {
		r.postCommandResponse("The active stage is the first one.")
		return
	}

	_, err = r.incidentService.ChangeActiveStage(incidentID, r.args.UserId, currentIncident.ActiveStage-1)
	if err != nil {
		r.warnUserAndLogErrorf("Error changing active stage of incident '%s': %v", incidentID, err)
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

func (r *Runner) actionTestSelf(args []string) {
	if r.pluginAPI.Configuration.GetConfig().ServiceSettings.EnableTesting == nil ||
		!*r.pluginAPI.Configuration.GetConfig().ServiceSettings.EnableTesting {
		r.postCommandResponse(helpText)
		return
	}

	if !r.pluginAPI.User.HasPermissionTo(r.args.UserId, model.PERMISSION_MANAGE_SYSTEM) {
		r.postCommandResponse("Running the self-test is restricted to system administrators.")
		return
	}

	if len(args) != 3 || args[0] != confirmPrompt || args[1] != "TEST" || args[2] != "SELF" {
		r.postCommandResponse("Are you sure you want to self-test (which will nuke the database and delete all data -- instances, configuration)? " +
			"All incident data will be lost. To self-test, type `/incident test self CONFIRM TEST SELF`")
		return
	}

	if err := r.incidentService.NukeDB(); err != nil {
		r.postCommandResponse("There was an error while nuking db. Err: " + err.Error())
		return
	}

	shortDescription := "A short description."
	longDescription := `A very long description describing the item in a very descriptive way. Now with Markdown syntax! We have *italics* and **bold**. We have [external](http://example.com) and [internal links](/ad-1/com.mattermost.plugin-incident-management/playbooks). We have even links to channels: ~town-square. And links to users: @sysadmin, @user-1. We do have the usual headings and lists, of course:
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
	playbookID, err := r.playbookService.Create(testPlaybook, r.args.UserId)
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
	if err = r.playbookService.Update(gotplaybook, r.args.UserId); err != nil {
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

	todeleteid, err := r.playbookService.Create(testPlaybook, r.args.UserId)
	if err != nil {
		r.postCommandResponse("There was an error while creating playbook. Err: " + err.Error())
		return
	}
	testPlaybook.ID = todeleteid
	if err = r.playbookService.Delete(testPlaybook, r.args.UserId); err != nil {
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
		PlaybookID:         gotplaybook.ID,
		Checklists:         gotplaybook.Checklists,
		BroadcastChannelID: gotplaybook.BroadcastChannelID,
	}, r.args.UserId, true)
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

func (r *Runner) actionTest(args []string) {
	if r.pluginAPI.Configuration.GetConfig().ServiceSettings.EnableTesting == nil ||
		!*r.pluginAPI.Configuration.GetConfig().ServiceSettings.EnableTesting {
		r.postCommandResponse("Setting `EnableTesting` must be set to `true` to run the test command.")
		return
	}

	if !r.pluginAPI.User.HasPermissionTo(r.args.UserId, model.PERMISSION_MANAGE_SYSTEM) {
		r.postCommandResponse("Running the test command is restricted to system administrators.")
		return
	}

	if len(args) < 1 {
		r.postCommandResponse("The `/incident test` command needs at least one command.")
		return
	}

	command := strings.ToLower(args[0])
	var params = []string{}
	if len(args) > 1 {
		params = args[1:]
	}

	switch command {
	case "create-incident":
		r.actionTestCreate(params)
		return
	case "bulk-data":
		r.actionTestData(params)
	case "self":
		r.actionTestSelf(params)
	default:
		r.postCommandResponse(fmt.Sprintf("Command '%s' unknown.", args[0]))
		return
	}
}

func (r *Runner) actionTestCreate(params []string) {
	if len(params) < 3 {
		r.postCommandResponse("The command expects three parameters: <playbook_id> <timestamp> <incident name>")
		return
	}

	playbookID := params[0]
	if !model.IsValidId(playbookID) {
		r.postCommandResponse("The first parameter, <playbook_id>, must be a valid ID.")
		return
	}
	thePlaybook, err := r.playbookService.Get(playbookID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("The playbook with ID '%s' does not exist.", playbookID))
		return
	}

	creationTimestamp, err := time.Parse("2006-01-02", params[1])
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Timestamp '%s' could not be parsed as a date. If you want the incident to start on January 2, 2006, the timestamp should be '2006-01-02'.", params[1]))
		return
	}

	incidentName := strings.Join(params[2:], " ")

	theIncident := &incident.Incident{
		Header: incident.Header{
			Name:            incidentName,
			CommanderUserID: r.args.UserId,
			TeamID:          r.args.TeamId,
		},
		PlaybookID: playbookID,
		Checklists: thePlaybook.Checklists,
	}

	newIncident, err := r.incidentService.CreateIncident(theIncident, r.args.UserId, true)
	if err != nil {
		r.warnUserAndLogErrorf("unable to create incident: %v", err)
		return
	}

	if err = r.incidentService.ChangeCreationDate(newIncident.ID, creationTimestamp); err != nil {
		r.warnUserAndLogErrorf("unable to change date of recently created incident: %v", err)
		return
	}

	channel, err := r.pluginAPI.Channel.Get(newIncident.ChannelID)
	if err != nil {
		r.warnUserAndLogErrorf("unable to retrieve information of incident's channel: %v", err)
		return
	}

	r.postCommandResponse(fmt.Sprintf("Incident successfully created: ~%s.", channel.Name))
}

func (r *Runner) actionTestData(params []string) {
	if len(params) < 4 {
		r.postCommandResponse("`/incident test bulk-data` expects at least 4 arguments: [ongoing] [ended] [begin] [end]. Optionally, a fifth argument can be added: [seed].")
		return
	}

	ongoing, err := strconv.Atoi(params[0])
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("The provided value for ongoing incidents, '%s', is not an integer.", params[0]))
		return
	}

	ended, err := strconv.Atoi(params[1])
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("The provided value for ended incidents, '%s', is not an integer.", params[1]))
		return
	}

	begin, err := time.Parse("2006-01-02", params[2])
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("The provided value for the first possible date, '%s', is not a valid date. It needs to be in the format 2020-01-31.", params[2]))
		return
	}

	end, err := time.Parse("2006-01-02", params[3])
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("The provided value for the last possible date, '%s', is not a valid date. It needs to be in the format 2020-01-31.", params[3]))
		return
	}

	seed := time.Now().Unix()
	if len(params) > 4 {
		parsedSeed, err := strconv.ParseInt(params[4], 10, 0)
		if err != nil {
			r.postCommandResponse(fmt.Sprintf("The provided value for the random seed, '%s', is not an integer.", params[4]))
			return
		}

		seed = parsedSeed
	}

	r.generateTestData(ongoing, ended, begin, end, seed)
}

var fakeCompanyNames = []string{
	"Dach Inc",
	"Schuster LLC",
	"Kirlin Group",
	"Kohler Group",
	"Ruelas S.L.",
	"Armenta S.L.",
	"Vega S.A.",
	"Delarosa S.A.",
	"Sarabia S.A.",
	"Torp - Reilly",
	"Heathcote Inc",
	"Swift - Bruen",
	"Stracke - Lemke",
	"Shields LLC",
	"Bruen Group",
	"Senger - Stehr",
	"Krogh - Eide",
	"Andresen BA",
	"Hagen - Holm",
	"Martinsen BA",
	"Holm BA",
	"Berg BA",
	"Fossum RFH",
	"Nordskaug - Torp",
	"Gran - Lunde",
	"Nordby BA",
	"Ryan Gruppen",
	"Karlsson AB",
	"Nilsson HB",
	"Karlsson Group",
	"Miller - Harber",
	"Yost Group",
	"Leuschke Group",
	"Mertz Group",
	"Welch LLC",
	"Baumbach Group",
	"Ward - Schmitt",
	"Romaguera Group",
	"Hickle - Kemmer",
	"Stewart Corp",
}

var incidentNames = []string{
	"Cluster servers are down",
	"API performance degradation",
	"Customers unable to login",
	"Deployment failed",
	"Build failed",
	"Build timeout failure",
	"Server is unresponsive",
	"Server is crashing on start-up",
	"MM crashes on start-up",
	"Provider is down",
	"Database is unresponsive",
	"Database servers are down",
	"Database replica lag",
	"LDAP fails to sync",
	"LDAP account unable to login",
	"Broken MFA process",
	"MFA fails to login users",
	"UI is unresponsive",
	"Security threat",
	"Security breach",
	"Customers data breach",
	"SLA broken",
	"MySQL max connections error",
	"Postgres max connections error",
	"Elastic Search unresponsive",
	"Posts deleted",
	"Mentions deleted",
	"Replies deleted",
	"Cloud server is down",
	"Cloud deployment failed",
	"Cloud provisioner is down",
	"Cloud running out of memory",
	"Unable to create new users",
	"Installations in crashloop",
	"Compliance report timeout",
	"RN crash",
	"RN out of memory",
	"RN performance issues",
	"MM fails to start",
	"MM HA sync errors",
}

// generateTestData generates `numActiveIncidents` ongoing incidents and
// `numEndedIncidents` ended incidents, whose creation timestamp lies randomly
// between the `begin` and `end` timestamps.
// All incidents are created with a playbook randomly picked from the ones the
// user is a member of, and the randomness is controlled by the `seed` parameter
// to create reproducible results if needed.
func (r *Runner) generateTestData(numActiveIncidents, numEndedIncidents int, begin, end time.Time, seed int64) {
	rand.Seed(seed)

	beginMillis := begin.Unix() * 1000
	endMillis := end.Unix() * 1000

	numIncidents := numActiveIncidents + numEndedIncidents

	if numIncidents == 0 {
		r.postCommandResponse("Zero incidents created.")
		return
	}

	if !end.After(begin) {
		r.postCommandResponse("`end` must be a later date than `begin`")
		return
	}

	timestamps := make([]int64, 0, numIncidents)
	for i := 0; i < numIncidents; i++ {
		timestamp := rand.Int63n(endMillis-beginMillis) + beginMillis
		timestamps = append(timestamps, timestamp)
	}

	requesterInfo := playbook.RequesterInfo{
		UserID:          r.args.UserId,
		TeamID:          r.args.TeamId,
		UserIDtoIsAdmin: map[string]bool{r.args.UserId: permissions.IsAdmin(r.args.UserId, r.pluginAPI)},
		MemberOnly:      true,
	}

	playbooksResult, err := r.playbookService.GetPlaybooksForTeam(requesterInfo, r.args.TeamId, playbook.Options{})
	if err != nil {
		r.warnUserAndLogErrorf("Error getting playbooks: %v", err)
		return
	}

	if len(playbooksResult.Items) == 0 {
		r.postCommandResponse("You are not a member of any playbook. Create at least one playbook before generating the test data.")
		return
	}

	playbooks := make([]playbook.Playbook, 0, len(playbooksResult.Items))
	for _, thePlaybook := range playbooksResult.Items {
		wholePlaybook, err := r.playbookService.Get(thePlaybook.ID)
		if err != nil {
			r.warnUserAndLogErrorf("Error getting playbook: %v", err)
			return
		}

		playbooks = append(playbooks, wholePlaybook)
	}

	tableMsg := "| Incident name | Created at | Status |\n|-	|-	|-	|\n"
	incidents := make([]*incident.Incident, 0, numIncidents)
	for i := 0; i < numIncidents; i++ {
		thePlaybook := playbooks[rand.Intn(len(playbooks))]

		incidentName := incidentNames[rand.Intn(len(incidentNames))]
		// Give a company name to 1/3 of the incidents created
		if rand.Intn(3) == 0 {
			companyName := fakeCompanyNames[rand.Intn(len(fakeCompanyNames))]
			incidentName = fmt.Sprintf("[%s] %s", companyName, incidentName)
		}

		theIncident := &incident.Incident{
			Header: incident.Header{
				Name:            incidentName,
				CommanderUserID: r.args.UserId,
				TeamID:          r.args.TeamId,
			},
			PlaybookID: thePlaybook.ID,
			Checklists: thePlaybook.Checklists,
		}

		newIncident, err := r.incidentService.CreateIncident(theIncident, r.args.UserId, true)
		if err != nil {
			r.warnUserAndLogErrorf("Error creating incident: %v", err)
			return
		}

		createAt := timeutils.GetTimeForMillis(timestamps[i])
		err = r.incidentService.ChangeCreationDate(newIncident.ID, createAt)
		if err != nil {
			r.warnUserAndLogErrorf("Error changing creation date: %v", err)
			return
		}

		channel, err := r.pluginAPI.Channel.Get(newIncident.ChannelID)
		if err != nil {
			r.warnUserAndLogErrorf("Error retrieveing incident's channel: %v", err)
			return
		}

		status := "Ended"
		if i >= numEndedIncidents {
			status = "Ongoing"
		}
		tableMsg += fmt.Sprintf("|~%s|%s|%s|\n", channel.Name, createAt.Format("2006-01-02"), status)

		incidents = append(incidents, newIncident)
	}

	for i := 0; i < numEndedIncidents; i++ {
		err := r.incidentService.EndIncident(incidents[i].ID, r.args.UserId)
		if err != nil {
			r.warnUserAndLogErrorf("Error ending the incident: %v", err)
			return
		}
	}

	r.postCommandResponse(fmt.Sprintf("The test data was successfully generated:\n\n%s\n", tableMsg))
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
		r.warnUserAndLogErrorf("There was an error while nuking db: %v", err)
		return
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
	case "update":
		r.actionUpdate()
	case "stage":
		r.actionStage(parameters)
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
	case "test":
		r.actionTest(parameters)
	default:
		r.postCommandResponse(helpText)
	}

	return nil
}
