package client

import "fmt"

// ErrorResponse is an error from an API request.
type ErrorResponse struct {
	// Method is the HTTP verb used in the API request.
	Method string
	// URL is the HTTP endpoint used in the API request.
	URL string
	// StatusCode is the HTTP status code returned by the API.
	StatusCode int

	// Err is the error parsed from the API response.
	Err error `json:"error"`
}

// Unwrap exposes the underlying error of an ErrorResponse.
func (r *ErrorResponse) Unwrap() error {
	return r.Err
}

// Error describes the error from the API request.
func (r *ErrorResponse) Error() string {
	return fmt.Sprintf("%v %v [%d]: %v", r.Method, r.URL, r.StatusCode, r.Err)
}
