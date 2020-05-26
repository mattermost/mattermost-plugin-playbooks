package main

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"
)

// Requires MM_SERVICESETTINGS_SITEURL, MM_ADMIN_USERNAME, MM_ADMIN_PASSWORD environment variables to be set.
func main() {
	log.Println("Starting load test...")

	numGoRoutines := 1
	iterations := 50000
	log.Printf("numGoRoutines: %d, iterations: %d\n", numGoRoutines, iterations)

	client, user, err := getClient()
	if err != nil {
		log.Fatal("err", err)
	}

	teams, resp := client.GetTeamsForUser(user.Id, "")
	if resp.Error != nil {
		log.Fatal("err", resp.Error)
	}

	if len(teams) == 0 {
		log.Fatal("no teams found")
	}
	teamID := teams[0].Id
	userID := user.Id
	log.Printf("teamID: %s, userID: %s\n", teamID, userID)

	var g errgroup.Group
	for i := 0; i < numGoRoutines; i++ {
		g.Go(func() error {
			createIncidents(client, teamID, userID, iterations)
			return nil
		})
	}

	log.Println("Waiting for go routines to finish.")
	g.Wait()
	log.Println("Load test completed.")
}

func createIncidents(client *model.Client4, teamID, userID string, numberOfIncidents int) {
	incidentAPIURL := fmt.Sprintf("%s/plugins/com.mattermost.plugin-incident-response/api/v1/incidents/create-dialog", client.Url)

	dialogRequest := model.SubmitDialogRequest{
		TeamId:     teamID,
		UserId:     userID,
		State:      "{}",
		Submission: map[string]interface{}{incident.DialogFieldNameKey: model.NewId()},
	}

	for i := 0; i < numberOfIncidents; i++ {
		req, err := http.NewRequest(http.MethodPost, incidentAPIURL, bytes.NewBuffer(dialogRequest.ToJson()))
		req.Header.Set(model.HEADER_AUTH, client.AuthType+" "+client.AuthToken)
		resp, err := client.HttpClient.Do(req)
		if err != nil {
			fmt.Println("err", err.Error())
			continue
		}
		defer resp.Body.Close()
		fmt.Println("CreateIncident Response.Status:", resp.Status)
	}
}

func getClient() (*model.Client4, *model.User, error) {
	siteURL := os.Getenv("MM_SERVICESETTINGS_SITEURL")
	if siteURL == "" {
		return nil, nil, errors.New("siteURL is missing")
	}

	adminUsername := os.Getenv("MM_ADMIN_USERNAME")
	if adminUsername == "" {
		return nil, nil, errors.New("adminUsername is missing")
	}

	adminPassword := os.Getenv("MM_ADMIN_PASSWORD")
	if adminPassword == "" {
		return nil, nil, errors.New("adminPassword is missing")
	}

	client := model.NewAPIv4Client(siteURL)
	log.Printf("Authenticating as %s against %s.", adminUsername, siteURL)
	user, resp := client.Login(adminUsername, adminPassword)
	if resp.Error != nil {
		return nil, nil, fmt.Errorf("failed to login as %s: %w", adminUsername, resp.Error)
	}

	return client, user, nil
}
