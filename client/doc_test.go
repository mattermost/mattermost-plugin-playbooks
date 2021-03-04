package client_test

import (
	"context"
	"fmt"
	"log"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/client"
	"github.com/mattermost/mattermost-server/v5/model"
)

func Example() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	_, response := client4.Login("test@example.com", "testtest")
	if response.Error != nil {
		log.Fatal(response.Error)
	}

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
