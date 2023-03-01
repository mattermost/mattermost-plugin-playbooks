package main

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/product"
	"github.com/stretchr/testify/assert"
)

func TestAPI(t *testing.T) {
	e := Setup(t)
	e.CreateClients()

	t.Run("404", func(t *testing.T) {
		resp, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+product.GetProductID()+"/api/v0/nothing", nil, "")
		assert.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}
