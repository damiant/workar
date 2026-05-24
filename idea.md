- Typscript based Node cli server
- Typscript based Node cli client
- Rest API run in cloudflare worker


Server CLI runs work
Client CLI issues work and gets results
Worker get work requests and delivers work results

Storage
Database used is Turso SQLite. Keep a SQLite example database with the data structure and a migration.txt file containing the list of sql commands to run to update the database after each change.

## Auth
POST /api/users
{ username: "{identifier}" }
If username does not exist create a record of it in the users table. The apiKey is generated (255 characters a-z,A-Z,0-9) and returned back in the response.

POST /api/auth
{ username: "", apiKey: "" }
This will check the username and apiKey and return a non expiring JWT token (signing key is kept in storage settings). It fails if auth doesnt match and also has prevention of abuse (taking extra time to respond and preventing calls from the same location).

POST /api/work
Requires apiKey in header
{ type: "image-gen", prompt:"{user-prompt}", model: "sdxl-lightning" }

This will add the work to the database table `inputQueue` for the given `username` (as JSON string with the workId property applied). A unique id is generated for each work. This `workId` is returned in the response.

GET /api/work
Requires apiKey in header

This will check the database table `outQueue` for the given `username` (based on looking up the apiKey) and return the work response.

The work response will have a content type of image, or json, or text. The response header will have the work id in it. If there is no work response available then it will return 404.
Work responses can return in an error which is of the form:
{ type: "error", message: "error message "}

This can also have a query parameter ?poll which will keep checking the table if there is no work every 1 second for up to 600 seconds.

POST /api/deque
Requires apiKey in header

This will check to see if there is work to be in the `inputQueue` and dequeue it from the database. This will also add to a `processed` table which has the work, the requester info that took the work, and datetime.

The response with be the work JSON

POST /api/complete
Requires apiKey in header

This posts work that is completed to the `outQueue` which includes the workId, username, contentType, contentBody.

## Server CLI 
This is for waiting for work, processing it and sending it back.
Work of type `image-gen` will use:
`node image-gen-cli/src/cli.js -p "your prompt here" -m flux2-klein-4b`

Work definitions are defined in a work-defs.json file which will have something like:
```json
[{ 
   "type": "image-gen",
   "commands": ["node image-gen-cli/src/cli.js -p '@prompt' -m @model"],
   "contentType": "image/png"
}]
```
The properties like prompt and model and pull from the work json in a generic way that makes it extensible without code changes. You should be able to add new cli commands for work to be done, and be able to send work with new types without making code changes to support it.

##Client CLI

The client CLI should be able to register a user, auth, and send work which will waiting for completion and return the result. It will save content to a file by its work id and the content type and tell you. Eg `I saved the result to "work-123.png"`