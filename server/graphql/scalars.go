package graphql

import (
	"encoding/json"
)

// Define the scalar JSON type declared in the GraphQL schema
type JSON json.RawMessage
