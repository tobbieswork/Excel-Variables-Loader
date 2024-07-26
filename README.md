# Import Google Sheets Variables

This plugin synchronizes from Google Sheets to Figma Variables. It supports multiple columns as well as simple key-value forms.

## To create an API URL

1. open the Google Sheets you want to synchronize with Figma.
2. click the "Share" button in the top right corner, and select "Everyone with the link" from the general access.
3. Get the ${SHEET_ID} of the Google Sheets link in your browser's address bar.
4. Set ${TOKEN} by issuing an authorization token in Google Cloud Manager settings. (https://admin.google.com)
5. Set the scope for the rest of the data except for the columns (e.g. A2:D).
6. set ${RANGE} to a string that is the sum of the sheet name and the above range.

## Set up the rest

1. Enter a name for the collection. If the collection exists, delete it and add it again.
2. Except for the variable names, describe the modes (columns) separated by commas.
