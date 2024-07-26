async function fetchGoogleSheets(url) {
  const response = await fetch(url);
  const json = await response.json();
  return json.values;
}

function createCollection(name, columns, columnCount) {
  const collection = figma.variables.createVariableCollection(name);
  columns.forEach((col, colIndex) => {
    if (colIndex < columnCount) {
      if (colIndex === 0)
        collection.renameMode(collection.modes[0].modeId, col.trim());
      else
        collection.addMode(col.trim());
    }
  })
  return collection;
}

function createToken(collection, type, name, values, payload) {
  const token = figma.variables.createVariable(name, collection.id, type);
  values.forEach((value, index) => {
    token.setValueForMode(collection.modes[index].modeId, value);
  });

  payload.add += 1;
  return token;
}

function updateToken(collection, type, token, values, payload) {
  let isModified = false;
  values.forEach((value, index) => {
    const modeId = collection.modes[index].modeId;
    if (token.valuesByMode[modeId] !== value) {
      token.setValueForMode(modeId, value);
      isModified = true;
    }
  });

  if (isModified) payload.modify += 1;
  return token;
}

figma.showUI(__html__, { themeColors: true, width: 500, height: 600 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
  } else if (msg.type === 'load') {
    const sheetId = await figma.clientStorage.getAsync(`${figma.currentPage.id}:sheetId`);
    const range = await figma.clientStorage.getAsync(`${figma.currentPage.id}:range`);
    const apiKey = await figma.clientStorage.getAsync(`${figma.currentPage.id}:apiKey`);
    const collection = await figma.clientStorage.getAsync(`${figma.currentPage.id}:collection`);
    const columns = await figma.clientStorage.getAsync(`${figma.currentPage.id}:columns`);

    if (range !== undefined && 
        apiKey !== undefined &&
        sheetId !== undefined && 
        collection !== undefined && 
        columns !== undefined) {
      figma.ui.postMessage({
        type: 'update', range, apiKey, sheetId, collection, columns
      });
    }
  } else if (msg.type === 'check') {
    const collections = figma.variables.getLocalVariableCollections();
    let collection = collections.find((collection) => collection.name === msg.collection);
    figma.ui.postMessage({
      type: 'check', exist: collection !== undefined, columns: collection !== undefined ? collection.modes.map((mode) => mode.name) : []
    });
  } else if (msg.type === 'sync') {
    const payloadForFinish = {
      type: 'finish', add: 0, modify: 0, delete: 0, changed: false
    };
    let origin = [];
    let columns = [];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${msg.sheetId}/values/${msg.range}?key=${msg.apiKey}&majorDimension=COLUMNS`

    try {
      origin = await fetchGoogleSheets(url);
      if (origin === undefined) {
        alert("The data does not exist, please check the data in your Google Sheet.");
        return;
      }
    } catch(e) {
      alert("The Google Sheet URL is invalid.");
    } finally {
      figma.ui.postMessage({ type: 'done' });
    }

    if (msg.columns.length === 0) {
      for (let i = 1; i < origin.length; i++) {
        columns.push('Mode ' + i);
      }
    } else {
      columns = msg.columns;
    }

    const collections = figma.variables.getLocalVariableCollections();
    let collection = collections.find((collection) => collection.name === msg.collection);

    const columnCount = origin.length - 1;
    const keys = origin[0];

    if (collection !== undefined) {
      if (columns.length !== columnCount) {
        alert("The number of collection modes and the number of data columns are different.");
        return;
      }

      const variableMap = {};

      collection.variableIds.forEach((id) => {
        const variable = figma.variables.getVariableById(id);
        variableMap[variable.name] = {
          variable,
          modified: false,
        };
      })

      keys.forEach((key, rowIndex) => {
        const values = [];
        const newKey = key.split(".").join("_");

        columns.forEach((_, colIndex) => {
          if (colIndex < columnCount) {
            values.push(origin[colIndex + 1][rowIndex]);
          }
        });
        if (variableMap[newKey]) {
          updateToken(collection, "STRING", variableMap[newKey].variable, values, payloadForFinish);
          variableMap[newKey].modified = true;
        } else {
          createToken(collection, "STRING", newKey, values, payloadForFinish);
        }
      });

      Object.keys(variableMap).forEach((key) => {
        if (!variableMap[key].modified) {
          variableMap[key].variable.remove();
          payloadForFinish.delete += 1;
        }
      });
    } else {
      collection = createCollection(msg.collection, columns, columnCount);

      keys.forEach((key, rowIndex) => {
        const values = [];
        columns.forEach((_, colIndex) => {
          if (colIndex < columnCount) {
            values.push(origin[colIndex + 1][rowIndex]);
          }
        });
        createToken(collection, "STRING", key.split(".").join("_"), values, payloadForFinish);
      });
    }

    figma.ui.postMessage(payloadForFinish);

    await figma.clientStorage.setAsync(`${figma.currentPage.id}:sheetId`, msg.sheetId);
    await figma.clientStorage.setAsync(`${figma.currentPage.id}:range`, msg.range);
    await figma.clientStorage.setAsync(`${figma.currentPage.id}:apiKey`, msg.apiKey);
    await figma.clientStorage.setAsync(`${figma.currentPage.id}:collection`, msg.collection);
    await figma.clientStorage.setAsync(`${figma.currentPage.id}:columns`, columns);
  }
};
