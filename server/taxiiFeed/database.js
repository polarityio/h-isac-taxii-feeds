const fs = require('fs');
const path = require('path');
const Engine = require('tingodb')();
const { reduce, map } = require('lodash/fp');

class Database {
  constructor(databaseFolderName, collectionNames) {
    this.databaseFolderPath = path.join(__dirname, databaseFolderName);
    this.collectionNames = collectionNames;

    this.setupDatabaseFilesIfNotExists();

    this.db = new Engine.Db(this.databaseFolderPath, {});

    this.collections = reduce(
      (agg, collectionName) => ({
        ...agg,
        [collectionName]: this.db.collection(collectionName)
      }),
      {},
      this.collectionNames
    );
  }

  setupDatabaseFilesIfNotExists = () => {
    if (!fs.existsSync(this.databaseFolderPath)) {
      fs.mkdirSync(this.databaseFolderPath);

      map((collectionName) => {
        const filePath = path.join(this.databaseFolderPath, collectionName);
        
        fs.writeFileSync(filePath, '');
      }, this.collectionNames);
    } 
  };

  createDatabaseMethod = (method) => {
    const databaseMethod = async (collectionName, ...args) =>
      new Promise((resolve, reject) => {
        if (!this.collectionNames.includes(collectionName)) {
          throw new Error(`Invalid Database Collection Name: ${collectionName}`);
        }
        this.collections[collectionName][method](...args, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

    return databaseMethod;
  };

  insert = this.createDatabaseMethod('insert');
  update = this.createDatabaseMethod('update');
  remove = this.createDatabaseMethod('remove');
  count = this.createDatabaseMethod('count');
  createIndex = this.createDatabaseMethod('createIndex');
  findOne = this.createDatabaseMethod('findOne');
  /**
   * @param {object} [options] - Optional cursor settings.
   * @param {object} [options.sort] - Sorting order (e.g., { field: 1 or -1 }).
   * @param {number} [options.limit] - Limit the number of documents.
   * @param {number} [options.skip] - Number of documents to skip.
   * @returns {Promise<Array>} - Resolves to an array of matching documents.
   */
  find = async (collectionName, query = {}, options = {}) =>
    new Promise((resolve, reject) => {
      try {
        if (!this.collectionNames.includes(collectionName)) {
          throw new Error(`Invalid Database Collection Name: ${dataType}`);
        }

        let cursor = this.collections[collectionName].find(query);

        // Apply optional cursor methods
        if (options.sort) cursor = cursor.sort(options.sort);
        if (options.limit) cursor = cursor.limit(options.limit);
        if (options.skip) cursor = cursor.skip(options.skip);

        // Convert cursor to an array
        cursor.toArray((err, docs) => {
          if (err) reject(err);
          else resolve(docs);
        });
      } catch (error) {
        reject(error);
      }
    });

  collectionIsEmpty = async (collectionName) => {
    const count = await this.count(collectionName, {});
    return count === 0;
  };
}

module.exports = new Database('data', ['collections', 'indicatorObjects']);
