const { db } = require('../config/firebase-admin');

class BaseModel {
  constructor(collectionName) {
    this.collection = db.collection(collectionName);
  }

  async create(data) {
    try {
      const docRef = this.collection.doc();
      const now = new Date();
      const documentData = {
        ...data,
        id: docRef.id,
        created_at: now,
        updated_at: now
      };
      
      await docRef.set(documentData);
      return this.findById(docRef.id);
    } catch (error) {
      console.error(`Error creating document in ${this.collection.id}:`, error);
      throw error;
    }
  }

  async findById(id) {
    try {
      const doc = await this.collection.doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
      console.error(`Error finding document ${id} in ${this.collection.id}:`, error);
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date()
      };
      
      await this.collection.doc(id).update(updateData);
      return this.findById(id);
    } catch (error) {
      console.error(`Error updating document ${id} in ${this.collection.id}:`, error);
      throw error;
    }
  }

  async delete(id) {
    try {
      await this.collection.doc(id).delete();
      return true;
    } catch (error) {
      console.error(`Error deleting document ${id} in ${this.collection.id}:`, error);
      throw error;
    }
  }

  async findAll(conditions = {}) {
    try {
      let query = this.collection;
      
      // Build query based on conditions
      Object.keys(conditions).forEach(key => {
        query = query.where(key, '==', conditions[key]);
      });
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error finding all documents in ${this.collection.id}:`, error);
      throw error;
    }
  }

  async findOne(conditions) {
    try {
      const results = await this.findAll(conditions);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error(`Error finding one document in ${this.collection.id}:`, error);
      throw error;
    }
  }
}

module.exports = BaseModel;