# How to Add Secret File in Render

## Step-by-Step for Secret File Modal

When you click "+ Add Secret File" in Render, a modal opens. Here's what to do:

### 1. Filename Field
- **Change:** `file.txt` → `serviceAccountKey.json`
- This is the name of the file that will be created

### 2. File Contents Field
- **Open** your `backend/serviceAccountKey.json` file in a text editor (VS Code, Notepad, etc.)
- **Select All** (Ctrl+A) and **Copy** (Ctrl+C) the entire JSON content
- **Paste** it into the "File Contents" text area in the modal

### 3. Save
- Click the **"Save"** button
- The file will be uploaded and accessible at `/app/backend/serviceAccountKey.json`

## Example

Your `serviceAccountKey.json` should look something like:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  ...
}
```

**Just copy the entire JSON object** (including all the curly braces) and paste it into the File Contents field.

## Important Notes

- ✅ Make sure the filename is exactly `serviceAccountKey.json`
- ✅ Copy the entire JSON file content (not just parts of it)
- ✅ The file will be placed at `/app/backend/serviceAccountKey.json` automatically
- ✅ You don't need to specify the path in the modal - Render handles that

## After Saving

Once saved, you should see `serviceAccountKey.json` listed in the Secret Files section. Your backend will be able to access it at the path specified in your environment variable: `/app/backend/serviceAccountKey.json`

