package app

type GenericChannelActionWithoutPayload struct {
	ID          string      `json:"id"`
	ChannelID   string      `json:"channel_id"`
	Enabled     bool        `json:"enabled"`
	DeleteAt    int64       `json:"delete_at"`
	ActionType  ActionType  `json:"action_type"`
	TriggerType TriggerType `json:"trigger_type"`
}

type GenericChannelAction struct {
	GenericChannelActionWithoutPayload
	Payload interface{} `json:"payload"`
}

type WelcomeMessagePayload struct {
	Message string `json:"message" mapstructure:"message"`
}

type ActionType string
type TriggerType string

const (
	// Action types: add new types to the ValidTriggerTypes array below
	ActionTypeWelcomeMessage    ActionType = "send_welcome_message"

	// Trigger types: add new types to the ValidTriggerTypes array below
	TriggerTypeNewMemberJoins TriggerType = "new_member_joins"
)

var ValidActionTypes = []ActionType{
	ActionTypeWelcomeMessage,
}

var ValidTriggerTypes = []TriggerType{
	TriggerTypeNewMemberJoins,
}

type GetChannelActionOptions struct {
	ActionType  ActionType
	TriggerType TriggerType
}

type ChannelActionService interface {
	// Create creates a new action
	Create(action GenericChannelAction) (string, error)

	// Get returns the action identified by id
	Get(id string) (GenericChannelAction, error)

	// GetChannelActions returns all actions in channelID,
	// filtered with the options if different from its zero value
	GetChannelActions(channelID string, options GetChannelActionOptions) ([]GenericChannelAction, error)

	// Validate checks that the action type, trigger type and
	// payload are all valid and consistent with each other
	Validate(action GenericChannelAction) error

	// Update updates an existing action identified by action.ID
	Update(action GenericChannelAction) error

	// CheckAndSendMessageOnJoin checks if userID has viewed channelID and sends
	// the registered welcome message action. Returns true if the message was sent.
	CheckAndSendMessageOnJoin(userID, channelID string) bool
}

type ChannelActionStore interface {
	// Create creates a new action
	Create(action GenericChannelAction) (string, error)

	// Get returns the action identified by id
	Get(id string) (GenericChannelAction, error)

	// GetChannelActions returns all actions in channelID,
	// filtered with the options if different from its zero value
	GetChannelActions(channelID string, options GetChannelActionOptions) ([]GenericChannelAction, error)

	// Update updates an existing action identified by action.ID
	Update(action GenericChannelAction) error

	// HasViewedChannel returns true if userID has viewed channelID
	HasViewedChannel(userID, channelID string) bool

	// SetViewedChannel records that userID has viewed channelID. NOTE: does not check if there is already a
	// record of that userID/channelID (i.e., will create duplicate rows)
	SetViewedChannel(userID, channelID string) error

	// SetViewedChannel records that all users in userIDs have viewed channelID.
	SetMultipleViewedChannel(userIDs []string, channelID string) error
}
