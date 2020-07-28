package client

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

// setup sets up a test HTTP server along with a workflows Client that is
// configured to talk to that test server. Tests should register handlers on
// mux which provide mock responses for the API method being tested.
func setup(t *testing.T) (client *Client, mux *http.ServeMux, serverURL string) {
	baseURLPath := ""

	// mux is the HTTP request multiplexer used with the test server.
	mux = http.NewServeMux()

	apiHandler := http.NewServeMux()
	apiHandler.Handle(baseURLPath+"/", http.StripPrefix(baseURLPath, mux))

	// server is a test HTTP server used to provide mock API responses.
	server := httptest.NewServer(apiHandler)
	t.Cleanup(server.Close)

	// client is the workflows client being tested and is
	// configured to use test server.
	client, _ = NewClient("", nil)
	url, _ := url.Parse(server.URL + baseURLPath + "/")
	client.BaseURL = url

	return client, mux, server.URL
}

func testMethod(t *testing.T, r *http.Request, want string) {
	t.Helper()
	got := r.Method
	require.Equal(t, want, got, "request method: %v, want %v", got, want)
}

type values map[string]string

func testFormValues(t *testing.T, r *http.Request, values values) {
	t.Helper()
	want := url.Values{}
	for k, v := range values {
		want.Set(k, v)
	}

	r.ParseForm()
	got := r.Form
	require.Equal(t, want, got, "request parameters: %v, want %v", got, want)
}
