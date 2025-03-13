/* database.js - Handles all IndexedDB operations */

class SrefDatabase {
    constructor() {
        this.dbName = 'midjourneyTracker';
        this.dbVersion = 3; // Increased version for new schema
        this.db = null;
        this.initDb();
    }
    
    async initDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                
                // Create sref_sets store if it doesn't exist
                if (!db.objectStoreNames.contains('sref_sets')) {
                    const store = db.createObjectStore('sref_sets', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('base_number', 'baseNumber', { unique: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Create or update images store
                if (!db.objectStoreNames.contains('images')) {
                    const imagesStore = db.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
                    imagesStore.createIndex('set_id', 'setId', { unique: false });
                    imagesStore.createIndex('timestamp', 'timestamp', { unique: false });
                    imagesStore.createIndex('sref_value', 'srefValue', { unique: false });
                } else if (oldVersion < 3) {
                    // Upgrade from version 2 to 3: Add sref_value index to images store
                    const transaction = event.target.transaction;
                    const imagesStore = transaction.objectStore('images');
                    
                    // Check if index already exists
                    if (!imagesStore.indexNames.contains('sref_value')) {
                        imagesStore.createIndex('sref_value', 'srefValue', { unique: false });
                    }
                    
                    // Migrate existing data to have srefValue - with safer approach
                    const imagesCursorRequest = imagesStore.openCursor();
                    
                    imagesCursorRequest.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) {
                            // Get the image data
                            const imageData = cursor.value;
                            
                            // If it doesn't have a srefValue, add one
                            if (imageData.srefValue === undefined) {
                                // Set a default value as null (will be handled elsewhere)
                                imageData.srefValue = null;
                                
                                // Try to look up the set to get the base number
                                try {
                                    const setsTransaction = db.transaction(['sref_sets'], 'readonly');
                                    const setsStore = setsTransaction.objectStore('sref_sets');
                                    const getRequest = setsStore.get(imageData.setId);
                                    
                                    getRequest.onsuccess = () => {
                                        if (getRequest.result) {
                                            // Set the srefValue to the baseNumber
                                            imageData.srefValue = getRequest.result.baseNumber;
                                        }
                                        
                                        // Update the record
                                        const updateRequest = cursor.update(imageData);
                                        
                                        updateRequest.onsuccess = () => {
                                            cursor.continue();
                                        };
                                        
                                        updateRequest.onerror = () => {
                                            cursor.continue();
                                        };
                                    };
                                    
                                    getRequest.onerror = () => {
                                        // If error, just update with null srefValue
                                        const updateRequest = cursor.update(imageData);
                                        
                                        updateRequest.onsuccess = () => {
                                            cursor.continue();
                                        };
                                        
                                        updateRequest.onerror = () => {
                                            cursor.continue();
                                        };
                                    };
                                } catch (error) {
                                    // If transaction fails, just update with null srefValue
                                    const updateRequest = cursor.update(imageData);
                                    
                                    updateRequest.onsuccess = () => {
                                        cursor.continue();
                                    };
                                    
                                    updateRequest.onerror = () => {
                                        cursor.continue();
                                    };
                                }
                            } else {
                                cursor.continue();
                            }
                        }
                    };
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            
            request.onerror = (event) => {
                reject('Error opening database: ' + event.target.errorCode);
            };
        });
    }
    
    async addSet(baseNumber, notes = '') {
        await this.initDb();
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction(['sref_sets'], 'readwrite');
            const store = transaction.objectStore('sref_sets');
            
            const set = {
                baseNumber: baseNumber,
                increment: 10,
                timestamp: new Date(),
                notes: notes
            };
            
            const request = store.add(set);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = (event) => {
                reject('Error adding set: ' + event.target.errorCode);
            };
        });
    }
    
    async isSetUsed(baseNumber) {
        await this.initDb();
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction(['sref_sets'], 'readonly');
            const store = transaction.objectStore('sref_sets');
            const index = store.index('base_number');
            
            // Check if the exact base number exists
            const request = index.get(baseNumber);
            
            request.onsuccess = () => {
                if (request.result) {
                    resolve(true);
                    return;
                }
                
                // If exact base doesn't exist, check for overlaps
                const range = IDBKeyRange.bound(
                    baseNumber - 9, // Check if any set ends within our range
                    baseNumber + 9  // Check if any set starts within our range
                );
                
                const cursorRequest = index.openCursor(range);
                let isUsed = false;
                
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const existingBase = cursor.value.baseNumber;
                        const existingEnd = existingBase + 9;
                        
                        // Check if there's overlap
                        if ((baseNumber <= existingEnd && baseNumber + 9 >= existingBase)) {
                            isUsed = true;
                        }
                        cursor.continue();
                    } else {
                        resolve(isUsed);
                    }
                };
                
                cursorRequest.onerror = (event) => {
                    reject('Error checking for overlaps: ' + event.target.errorCode);
                };
            };
            
            request.onerror = (event) => {
                reject('Error checking if set exists: ' + event.target.errorCode);
            };
        });
    }
    
    async getAllSets() {
        await this.initDb();
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction(['sref_sets'], 'readonly');
            const store = transaction.objectStore('sref_sets');
            const index = store.index('timestamp');
            
            const request = index.openCursor(null, 'prev'); // Sort by newest first
            const sets = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    sets.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(sets);
                }
            };
            
            request.onerror = (event) => {
                reject('Error getting sets: ' + event.target.errorCode);
            };
        });
    }
    
    async deleteSet(id) {
        await this.initDb();
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            // First delete associated images
            const imagesTransaction = this.db.transaction(['images'], 'readwrite');
            const imagesStore = imagesTransaction.objectStore('images');
            const imagesIndex = imagesStore.index('set_id');
            
            const imagesRequest = imagesIndex.openCursor(IDBKeyRange.only(id));
            
            imagesRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    imagesStore.delete(cursor.value.id);
                    cursor.continue();
                } else {
                    // After deleting images, delete the set
                    const setsTransaction = this.db.transaction(['sref_sets'], 'readwrite');
                    const setsStore = setsTransaction.objectStore('sref_sets');
                    
                    const setRequest = setsStore.delete(id);
                    
                    setRequest.onsuccess = () => {
                        resolve();
                    };
                    
                    setRequest.onerror = (event) => {
                        reject('Error deleting set: ' + event.target.errorCode);
                    };
                }
            };
            
            imagesRequest.onerror = (event) => {
                reject('Error deleting images: ' + event.target.errorCode);
            };
        });
    }
    
    async saveImage(setId, imageData, srefValue = null) {
        await this.initDb();
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            
            // If srefValue is not provided, try to get the base number
            const getDefaultSrefValue = async () => {
                try {
                    const transaction = this.db.transaction(['sref_sets'], 'readonly');
                    const store = transaction.objectStore('sref_sets');
                    const request = store.get(setId);
                    
                    return new Promise((resolve) => {
                        request.onsuccess = () => {
                            if (request.result) {
                                resolve(request.result.baseNumber);
                            } else {
                                resolve(null); // No base number found
                            }
                        };
                        
                        request.onerror = () => {
                            resolve(null); // Error getting base number
                        };
                    });
                } catch (e) {
                    return null;
                }
            };
            
            // If srefValue is null or undefined, get the default
            if (srefValue === null || srefValue === undefined) {
                getDefaultSrefValue().then(defaultValue => {
                    const image = {
                        setId: setId,
                        data: imageData,
                        srefValue: defaultValue,
                        timestamp: new Date()
                    };
                    
                    const request = store.add(image);
                    
                    request.onsuccess = () => {
                        resolve(request.result);
                    };
                    
                    request.onerror = (event) => {
                        reject('Error saving image: ' + event.target.errorCode);
                    };
                });
            } else {
                // If srefValue is provided, use it directly
                const image = {
                    setId: setId,
                    data: imageData,
                    srefValue: srefValue,
                    timestamp: new Date()
                };
                
                const request = store.add(image);
                
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = (event) => {
                    reject('Error saving image: ' + event.target.errorCode);
                };
            }
        });
    }
    
    async getImagesForSet(setId) {
        await this.initDb();
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const index = store.index('set_id');
            
            const request = index.getAll(setId);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = (event) => {
                reject('Error getting images: ' + event.target.errorCode);
            };
        });
    }
    
    async getImagesGroupedBySref(setId) {
        await this.initDb();
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            // Get all images for this set
            this.getImagesForSet(setId).then(images => {
                // Group images by srefValue
                const groupedImages = {};
                
                images.forEach(image => {
                    const srefValue = image.srefValue || 'unassigned';
                    
                    if (!groupedImages[srefValue]) {
                        groupedImages[srefValue] = [];
                    }
                    
                    groupedImages[srefValue].push(image);
                });
                
                resolve(groupedImages);
            }).catch(error => {
                reject(error);
            });
        });
    }

    async getAllImages() {
        await this.initDb();

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }

            const transaction = this.db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject('Error getting all images: ' + event.target.errorCode);
            };
        });
    }
    
    async deleteImage(imageId) {
        await this.initDb();
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            
            const request = store.delete(imageId);
            
            request.onsuccess = () => {
                resolve();
            };
            
            request.onerror = (event) => {
                reject('Error deleting image: ' + event.target.errorCode);
            };
        });
    }
}
