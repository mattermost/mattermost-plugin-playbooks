package main

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	ir "github.com/mattermost/mattermost-plugin-incident-response/client"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"golang.org/x/oauth2"
)

// Requires MM_SERVICESETTINGS_SITEURL, MM_ADMIN_USERNAME, MM_ADMIN_PASSWORD environment variables to be set.
func main() {
	log.Println("Starting load test...")

	numGoRoutines := 1
	iterations := 50000
	log.Printf("numGoRoutines: %d, iterations: %d\n", numGoRoutines, iterations)

	c, _, err := getClient()
	if err != nil {
		log.Fatal("err", err)
	}

	siteURL := os.Getenv("MM_SERVICESETTINGS_SITEURL")

	httpClient := oauth2.NewClient(context.Background(), oauth2.StaticTokenSource(&oauth2.Token{
		AccessToken: c.AuthToken,
	}))
	log.Print("autho", c.AuthToken)
	log.Print("autho", c.HttpHeader)

	irClient, err := ir.NewClient(siteURL, httpClient)
	if err != nil {
		log.Fatal(err)
	}

	// i, err := createExample(irClient)
	// if err != nil {
	// 	log.Fatal("err: ", err)
	// }
	// i, err := getExample(irClient)
	// if err != nil {
	// 	log.Fatal("err: ", err)
	// }
	i, err := paginationExample(irClient)
	if err != nil {
		log.Fatal("err: ", err)
	}
	log.Println("incident: ", i)
}

// createExample -- recommended
func createExample(client *ir.Client) (*ir.Incident, error) {
	incident, err := client.Incidents.Create(context.Background(), ir.IncidentCreateOptions{
		Name:            "name",
		CommanderUserID: "",
		TeamID:          "",
	})
	if err != nil {
		return nil, err
	}

	return incident, nil
}

// getExample -- recommended
func getExample(client *ir.Client) (*ir.Incident, error) {
	incident, err := client.Incidents.Get(context.Background(), "1igmynxs77ywmcbwbsujzktter")
	if err != nil {
		return nil, err
	}

	return incident, nil
}

// updateExample -- recommended
func updateExample(client *ir.Client) (*ir.Incident, error) {
	incident, err := client.Incidents.Update(context.Background(), "incidentID", ir.IncidentUpdateOptions{
		CommanderUserID: ir.String("new-name"),
	})
	if err != nil {
		return nil, err
	}

	return incident, nil
}

// getByChannelIDExample -- recommended
func getByChannelIDExample(client *ir.Client) (*ir.Incident, error) {
	i, err := client.Incidents.GetByChannelID(context.Background(), "PrimaryChannelID")
	if err != nil {
		return nil, err
	}

	return i, nil
}

// paginationExample -- recommended
func paginationExample(client *ir.Client) ([]*ir.Incident, error) {
	var allIncidents []*ir.Incident

	// 0-index based pages
	for page := 0; ; page++ {
		list, err := client.Incidents.List(context.Background(), ir.IncidentListOptions{
			ListOptions: ir.ListOptions{Page: page, PerPage: 2},
		})
		if err != nil {
			return nil, err
		}
		fmt.Println("list: ", list)

		allIncidents = append(allIncidents, list.Items...)
		if !list.HasMore {
			break
		}
	}

	return allIncidents, nil
}

// updateStepExample3
func updateStepExample3(client *ir.Client) (*ir.Step, error) {
	step, err := client.Incidents.CreateStep(context.Background(), "incidentID", ir.StepCreateOptions{
		Title: "new-name",
	})
	if err != nil {
		return nil, err
	}

	return step, nil
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
