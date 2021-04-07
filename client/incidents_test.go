package client_test

import (
	"context"
	"fmt"
	"log"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/client"
	"github.com/mattermost/mattermost-server/v5/model"
)

func ExampleIncidentsService_Get() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	client4.Login("test@example.com", "testtest")

	c, err := client.New(client4)
	if err != nil {
		log.Fatal(err)
	}

	incidentID := "h4n3h7s1qjf5pkis4dn6cuxgwa"
	incident, err := c.Incidents.Get(ctx, incidentID)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Incident Name: %s\n", incident.Name)
}

func ExampleIncidentsService_List() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	_, response := client4.Login("test@example.com", "testtest")
	if response.Error != nil {
		log.Fatal(response.Error.Error())
	}

	teams, response := client4.GetAllTeams("", 0, 1)
	if response.Error != nil {
		log.Fatal(response.Error.Error())
	}
	if len(teams) == 0 {
		log.Fatal("no teams for this user")
	}

	c, err := client.New(client4)
	if err != nil {
		log.Fatal(err)
	}

	var incidents []client.Incident
	for page := 0; ; page++ {
		result, err := c.Incidents.List(ctx, page, 100, client.IncidentListOptions{
			TeamID:    teams[0].Id,
			Sort:      client.SortByCreateAt,
			Direction: client.SortDesc,
		})
		if err != nil {
			log.Fatal(err)
		}

		incidents = append(incidents, result.Items...)
		if !result.HasMore {
			break
		}
	}

	for _, incident := range incidents {
		fmt.Printf("Incident Name: %s\n", incident.Name)
	}
}
