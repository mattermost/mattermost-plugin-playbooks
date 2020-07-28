package client

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIncidentsService_Get(t *testing.T) {
	client, mux, _ := setup(t)

	mux.HandleFunc("/"+buildAPIURL(apiVersion+"/incidents/1"), func(w http.ResponseWriter, r *http.Request) {
		testMethod(t, r, "GET")
		fmt.Fprint(w, `{"id": "1"}`)
	})

	i, err := client.Incidents.Get(context.Background(), "1")
	require.NoError(t, err)

	want := &Incident{ID: "1"}
	require.Equal(t, want, i)
}

func TestIncidentsService_List(t *testing.T) {
	client, mux, _ := setup(t)

	mux.HandleFunc("/"+buildAPIURL(apiVersion+"/incidents"), func(w http.ResponseWriter, r *http.Request) {
		testMethod(t, r, "GET")
		testFormValues(t, r, values{
			"page": "2",
		})
		fmt.Fprint(w, `{}`)
	})

	list, err := client.Incidents.List(context.Background(), IncidentListOptions{ListOptions: ListOptions{Page: 2}})
	require.NoError(t, err)
	require.NotNil(t, list)
	require.Nil(t, list.Items)
	require.Equal(t, 0, list.TotalCount)
	require.Equal(t, 0, list.PageCount)
	require.False(t, list.HasMore)
}
