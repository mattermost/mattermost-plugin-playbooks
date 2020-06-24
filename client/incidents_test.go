package client

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIncidentsService_Get(t *testing.T) {
	client, mux, _, teardown := setup()
	defer teardown()

	mux.HandleFunc("/"+buildAPIURL(apiVersion+"/incidents/1"), func(w http.ResponseWriter, r *http.Request) {
		testMethod(t, r, "GET")
		fmt.Fprint(w, `{"id": "1"}`)
	})

	i, err := client.Incidents.Get(context.Background(), "1")
	require.NoError(t, err)

	want := &Incident{ID: "1"}
	require.Equal(t, want, i)
}
