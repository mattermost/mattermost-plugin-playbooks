// main handles resetting the plugin using the Client4 API
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

func main() {
	err := reset()
	if err != nil {
		fmt.Printf("Failed to reset: %s\n", err.Error())
		fmt.Println()
		fmt.Println("Usage:")
		fmt.Println("    reset <plugin id>")
		os.Exit(1)
	}
}

// deploy handles deployment of the plugin to a development server.
func reset() error {
	if len(os.Args) < 2 {
		return errors.New("invalid number of arguments")
	}

	pluginID := os.Args[1]

	siteURL := os.Getenv("MM_SERVICESETTINGS_SITEURL")
	adminToken := os.Getenv("MM_ADMIN_TOKEN")
	adminUsername := os.Getenv("MM_ADMIN_USERNAME")
	adminPassword := os.Getenv("MM_ADMIN_PASSWORD")

	if siteURL != "" {
		client := model.NewAPIv4Client(siteURL)

		if adminToken != "" {
			log.Printf("Authenticating using token against %s.", siteURL)
			client.SetToken(adminToken)

			return resetPlugin(client, pluginID)
		}

		if adminUsername != "" && adminPassword != "" {
			client := model.NewAPIv4Client(siteURL)
			log.Printf("Authenticating as %s against %s.", adminUsername, siteURL)
			_, resp := client.Login(adminUsername, adminPassword)
			if resp.Error != nil {
				return errors.Wrapf(resp.Error, "failed to login as %s: %s", adminUsername, resp.Error.Error())
			}

			return resetPlugin(client, pluginID)
		}
	}
	return errors.New("In order to reset, please set the following three environment variables:\n\n" +
		"MM_SERVICESETTINGS_SITEURL\nMM_ADMIN_USERNAME\nMM_ADMIN_PASSWORD\n\n" +
		"or, if using a token, set: MM_ADMIN_TOKEN")
}

// resetPlugin attempts to reset the plugin via the Client4 API.
func resetPlugin(client *model.Client4, pluginID string) error {
	log.Print("Disabling plugin.")
	_, resp := client.DisablePlugin(pluginID)
	if resp.Error != nil {
		return fmt.Errorf("failed to disable plugin: %s", resp.Error.Error())
	}

	log.Print("Enabling plugin.")
	_, resp = client.EnablePlugin(pluginID)
	if resp.Error != nil {
		return fmt.Errorf("failed to enable plugin: %s", resp.Error.Error())
	}

	return nil
}
