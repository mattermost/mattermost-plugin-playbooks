package main

import (
	"fmt"
	"os"

	"github.com/graph-gophers/graphql-go"
	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
)

func graphqlCheck() {
	opts := []graphql.SchemaOpt{
		graphql.UseFieldResolvers(),
		graphql.MaxParallelism(5),
	}

	root := &api.RootResolver{}

	if _, err := graphql.ParseSchema(api.SchemaFile, root, opts...); err != nil {
		fmt.Println("-------- Graphql Schema Error ---------")
		fmt.Printf("\n%v\n\n", err.Error())
		fmt.Println("---------------------------------------")
		os.Exit(1)
	}

	fmt.Println("Graphql schema seems valid.")

	os.Exit(0)
}
