# Quicklists

Quicklists is an AI-powered feature that analyzes conversation threads and generates structured checklists for playbook runs.

---

## Overview

When teams discuss tasks and action items in threads, those discussions can be difficult to track. Quicklists solves this by:

1. Analyzing a conversation thread using AI
2. Extracting actionable tasks into organized sections
3. Creating a playbook run with pre-populated checklists

---

## User Guide

### Using the Slash Command

Run the following command in any channel:

```
/playbook quicklist <post_id>
```

Where `<post_id>` is the ID of the root post of the thread you want to analyze.

**To get a post ID:**
1. Click the `...` menu on any post
2. Select "Copy Link"
3. The post ID is the last part of the URL (e.g., `abc123xyz` in `https://mattermost.example.com/team/pl/abc123xyz`)

### Using the Post Menu

Alternatively, you can generate a quicklist directly from any post:

1. Click the `...` menu on the post
2. Select "Generate checklist with AI"

### Reviewing the Generated Checklist

After running the command, a modal opens showing:

- **Run Name**: AI-suggested title for the playbook run
- **Sections**: Groups of related tasks
- **Items**: Individual actionable tasks with optional descriptions and due dates
- **Truncation Warning**: If the thread exceeded limits, a banner shows how many messages were not analyzed

### Providing Feedback

The checklist is read-only. To modify it:

1. Type your feedback in the input box (e.g., "Add a task for QA testing" or "Remove the marketing tasks")
2. Click "Send" or press Enter
3. The AI regenerates the checklist based on your feedback

You can refine the checklist multiple times before creating the run.

### Creating the Run

Once satisfied with the checklist:

1. Click "Create Run"
2. A new playbook run is created with all sections and items
3. You are redirected to the run view

---

## Administrator Guide

### Prerequisites

Quicklists requires the [Mattermost AI Plugin](https://github.com/mattermost/mattermost-plugin-agents) (mattermost-plugin-agents) to be installed and configured with at least one agent. Refer to the AI plugin's documentation for setup instructions.

### Configuration

Configure Quicklists in **System Console > Plugins > Playbooks**:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enable Quicklist Feature | Boolean | `false` | Enable or disable the quicklist feature |
| Quicklist Agent Bot ID | Text | (empty) | Bot ID of the AI agent to use for generation. Required when feature is enabled |
| Maximum Thread Messages | Number | `50` | Maximum number of messages to include when analyzing a thread |
| Maximum Thread Characters | Number | `10000` | Maximum characters to send to the AI agent |
| System Prompt | Long Text | (built-in) | Custom system prompt for AI checklist generation. Leave empty to use default |
| User Prompt Template | Long Text | (built-in) | Custom user prompt template. Use `%s` as placeholder for thread content. Leave empty to use default |

### Enabling the Feature

1. Install and configure mattermost-plugin-agents
2. Create or identify an AI agent and note its Bot ID
3. In System Console, navigate to **Plugins > Playbooks**
4. Set **Enable Quicklist Feature** to `true`
5. Enter the agent's Bot ID in **Quicklist Agent Bot ID**
6. Save the configuration

### Thread Truncation

When a thread exceeds the configured limits:

- **Message limit**: The root post and most recent messages are kept
- **Character limit**: Content is truncated to fit the limit
- Users see a warning banner indicating how many messages were not analyzed

Adjust `Maximum Thread Messages` and `Maximum Thread Characters` based on your AI agent's context window and performance requirements.

### Custom Prompts

You can customize the AI prompts to adjust the output format or behavior. The default prompts:

- Extract concrete, actionable tasks
- Group related tasks into 2-5 logical sections
- Use action verbs for task titles
- Include due dates only when explicitly mentioned
- Limit output to 20 items

When customizing the User Prompt Template, include `%s` where the thread content should be inserted.

---

## Troubleshooting

### "Quicklist feature is not enabled"

The feature is disabled in plugin settings. Ask your system administrator to enable it in **System Console > Plugins > Playbooks**.
Quicklist also requires experimental features to be enabled in the system settings.

### "AI plugin is not available"

The mattermost-plugin-agents is not installed or not running. Ensure the AI plugin is:
- Installed in your Mattermost instance
- Enabled in System Console
- Properly configured with at least one agent

### "AI agent is not configured"

The Quicklist Agent Bot ID is not set. Configure it in **System Console > Plugins > Playbooks**.

### "Could not find the specified post"

The post ID is invalid or the post has been deleted. Verify the post exists and you have the correct ID.

### "You don't have access to this channel"

You don't have permission to read the channel containing the thread. You can only generate quicklists from threads in channels you have access to.

### "No action items could be identified"

The AI could not extract actionable tasks from the thread. This can happen when:
- The thread contains only casual conversation
- The thread is too short to contain meaningful tasks
- The AI prompt needs adjustment for your use case

Try a different thread or ask your administrator to adjust the AI prompts.

### "AI service is temporarily unavailable"

The AI agent failed to respond. This is usually transient. Click "Retry" to try again. If the problem persists, check that the AI plugin is running correctly.

### "Could not parse AI response"

The AI returned an unexpected response format. Click "Retry" to try again. If the problem persists, the AI prompts may need adjustment.

### Thread truncation warning

If you see "X messages not analyzed", the thread exceeded the configured limits. The AI only sees the root post and most recent messages. For very long threads, consider:
- Breaking the discussion into smaller threads
- Asking your administrator to increase the limits (if the AI agent supports larger context)

---

## Security Considerations

- **Channel Permissions**: Users can only generate quicklists from threads in channels they have access to
- **Same-Channel Constraint**: Runs are always created in the same channel as the source thread to prevent information leakage
- **Feature Gate**: The feature requires explicit admin enablement
