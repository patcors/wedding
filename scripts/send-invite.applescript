-- Sends one text or one file to one number through Messages. Called by
-- scripts/send-invites.mjs; every value arrives through argv, never pasted
-- into the script, so apostrophes and quotes in a message can't break it.
--
--   osascript send-invite.applescript accounts
--     prints the service type of each enabled account, e.g. "iMessage, SMS"
--   osascript send-invite.applescript <imessage|sms|rcs> <+614…> text <message>
--   osascript send-invite.applescript <imessage|sms|rcs> <+614…> file <POSIX path>
--     Messages only delivers scripted files it can read: keep them in ~/Pictures.

on run argv
	if (count of argv) is 1 and item 1 of argv is "accounts" then
		set found to {}
		tell application "Messages"
			repeat with anAccount in (accounts whose enabled is true)
				set end of found to (service type of anAccount) as text
			end repeat
		end tell
		set AppleScript's text item delimiters to ", "
		return found as text
	end if

	if (count of argv) is not 4 then error "usage: accounts | <imessage|sms|rcs> <phone> <text|file> <message or path>"
	set serviceName to item 1 of argv
	set phone to item 2 of argv
	set kind to item 3 of argv
	set payload to item 4 of argv
	if kind is "file" then
		set theFile to POSIX file payload
	else if kind is not "text" then
		error "kind must be text or file, not " & kind
	end if

	tell application "Messages"
		if serviceName is "imessage" then
			set targetAccount to first account whose service type is iMessage
		else if serviceName is "sms" then
			set targetAccount to first account whose service type is SMS
		else if serviceName is "rcs" then
			set targetAccount to first account whose service type is RCS
		else
			error "service must be imessage, sms or rcs, not " & serviceName
		end if
		set targetParticipant to participant phone of targetAccount
		if kind is "file" then
			send theFile to targetParticipant
		else
			send payload to targetParticipant
		end if
	end tell
	return "ok"
end run
