package api

import (
	"context"

	"github.com/pkg/errors"
)

type rootResolver struct{}

func (r *rootResolver) Playbook(ctx context.Context, args struct {
	Id string
}) (*playbookResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	playbookID := args.Id
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.PlaybookView(userID, playbookID); err != nil {
		c.log.Warnf("public error message: %v; internal details: %v", "Not authorized", err)
		return nil, errors.New("Not authorized")
	}

	playbook, err := c.playbookService.Get(playbookID)
	if err != nil {
		return nil, err
	}

	return &playbookResolver{playbook}, nil
}

func (r *rootResolver) UpdatePlaybook(ctx context.Context, args struct {
	Id      string
	Updates struct {
		Title       *string
		Description *string
	}
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	setmap := map[string]interface{}{}
	if args.Updates.Title != nil {
		setmap["Title"] = *args.Updates.Title
	}
	if args.Updates.Description != nil {
		setmap["Description"] = *args.Updates.Description
	}

	if len(setmap) > 0 {
		if err := c.playbookStore.GraphqlUpdate(args.Id, setmap); err != nil {
			return "", err
		}
	}

	return args.Id, nil
}

func (_ *rootResolver) Thing() *testResolver {
	return &testResolver{
		Test{Thing: "thing", OtherThing: "otherthing"},
	}
}

type Test struct {
	Thing      string
	OtherThing string
}

type testResolver struct {
	Test
}

func (_ *testResolver) OtherThing() string { return "modified" }

/*func (h *GraphQLHandler) Playbooks(ctx context.Context, args struct {
	TeamID string
}) ([]playbook, error) {
	header, ok := ctx.Value(ctxKey{}).(http.Header)
	if !ok {
		return nil, errors.New("header not in context")
	}
	userID := header.Get("Mattermost-User-ID")
	reqInfo, err := app.GetRequesterInfo(userID, h.pluginAPI)
	if err != nil {
		return nil, errors.Wrap(err, "unable to get requester info")
	}
	appPB, err := h.playbookService.GetPlaybooksForTeam(reqInfo, args.TeamID, app.PlaybookFilterOptions{Page: 0, PerPage: 10})
	if err != nil {
		return nil, errors.Wrap(err, "unable to get playbooks")
	}
	apiPB := make([]playbook, len(appPB.Items))
	for i := range appPB.Items {
		apiPB[i] = playbook{appPB.Items[i]}
		fmt.Println(appPB.Items[i].Checklists)
	}
	return apiPB, nil
}*/
