# WriteRight Privacy Policy

Last updated: September 26, 2026

WriteRight is a writing assistant that checks text with an AI provider configured by the user.

## Data processed

When proofreading is enabled, WriteRight reads text entered in supported editable fields after the user pauses typing. It does not read password fields. The text is sent to the configured OpenRouter-compatible API endpoint to generate spelling and grammar suggestions.

## API keys

The user's API key and preferences are stored locally using `chrome.storage.local`. They are not synchronized by WriteRight and are not sent to the developer. The API key is sent to the configured API endpoint only to authenticate proofreading requests.

## Sharing and sale

WriteRight does not sell personal information, use it for advertising, or transmit it to the extension developer. Text sent to OpenRouter or another configured provider is governed by that provider's privacy and retention policies.

## Retention

WriteRight does not maintain a server or database and does not retain writing or API requests. Local settings remain in the browser until the user clears extension data or uninstalls the extension.

## Permissions

WriteRight requests access to websites so it can detect supported writing fields and display suggestions. Network access is also needed to contact the user's configured API endpoint. The `storage` permission stores settings locally.

## Contact

For privacy questions or support, open an issue at:
https://github.com/yuriohz/yugi/issues
