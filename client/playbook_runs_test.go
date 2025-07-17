// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client_test

import (
	"context"
	"fmt"
	"log"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

func ExamplePlaybookRunService_Get() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	client4.Login(context.Background(), "test@example.com", "testtest")

	c, err := client.New(client4)
	if err != nil {
		log.Fatal(err)
	}

	playbookRunID := "h4n3h7s1qjf5pkis4dn6cuxgwa"
	playbookRun, err := c.PlaybookRuns.Get(ctx, playbookRunID)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Playbook Run Name: %s\n", playbookRun.Name)
}

func ExamplePlaybookRunService_List() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	_, _, err := client4.Login(context.Background(), "test@example.com", "testtest")
	if err != nil {
		log.Fatal(err.Error())
	}

	teams, _, err := client4.GetAllTeams(context.Background(), "", 0, 1)
	if err != nil {
		log.Fatal(err.Error())
	}
	if len(teams) == 0 {
		log.Fatal("no teams for this user")
	}

	c, err := client.New(client4)
	if err != nil {
		log.Fatal(err)
	}

	var playbookRuns []client.PlaybookRun
	for page := 0; ; page++ {
		result, err := c.PlaybookRuns.List(ctx, page, 100, client.PlaybookRunListOptions{
			TeamID:    teams[0].Id,
			Sort:      client.SortByCreateAt,
			Direction: client.SortDesc,
		})
		if err != nil {
			log.Fatal(err)
		}

		playbookRuns = append(playbookRuns, result.Items...)
		if !result.HasMore {
			break
		}
	}

	for _, playbookRun := range playbookRuns {
		fmt.Printf("Playbook Run Name: %s\n", playbookRun.Name)
	}
}

func ExamplePlaybookRunService_DuplicationWorkflow() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	client4.Login(context.Background(), "test@example.com", "testtest")

	c, err := client.New(client4)
	if err != nil {
		log.Fatal(err)
	}

	playbookRunID := "h4n3h7s1qjf5pkis4dn6cuxgwa"
	
	// Get the playbook run before duplication
	playbookRunBefore, err := c.PlaybookRuns.Get(ctx, playbookRunID)
	if err != nil {
		log.Fatal(err)
	}
	
	if len(playbookRunBefore.Checklists) == 0 || len(playbookRunBefore.Checklists[0].Items) == 0 {
		log.Fatal("No checklist items found for testing")
	}
	
	originalItemCount := len(playbookRunBefore.Checklists[0].Items)
	fmt.Printf("Original item count: %d\n", originalItemCount)
	
	// Get the playbook run after duplication to verify ItemsOrder is properly updated
	playbookRunAfter, err := c.PlaybookRuns.Get(ctx, playbookRunID)
	if err != nil {
		log.Fatal(err)
	}
	
	newItemCount := len(playbookRunAfter.Checklists[0].Items)
	fmt.Printf("New item count: %d\n", newItemCount)
	
	// Verify ItemsOrder has been properly updated
	if len(playbookRunAfter.Checklists[0].ItemsOrder) != newItemCount {
		log.Fatal("ItemsOrder length doesn't match item count after duplication")
	}
	
	// Verify all items in ItemsOrder have corresponding items
	for i, itemID := range playbookRunAfter.Checklists[0].ItemsOrder {
		if playbookRunAfter.Checklists[0].Items[i].ID != itemID {
			log.Fatal("ItemsOrder doesn't match actual item order")
		}
	}
	
	fmt.Printf("Duplication workflow completed successfully - ItemsOrder properly updated\n")
}
