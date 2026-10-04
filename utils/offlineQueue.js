import { storage } from '../services/storage';
import axios from 'axios';
import { BASE_URL } from '../services/api';
import { flushOfflineQueue } from '../services/offlineSync';

const QUEUE_KEY = 'offline_request_queue';

class OfflineQueue {
  isFlushing = false;
  healthInterval = null;

  /**
   * Add a request to the offline queue
   */
  async enqueue(endpoint, method, data) {
    try {
      const currentQueueStr = await storage.getItem(QUEUE_KEY);
      const queue = currentQueueStr ? JSON.parse(currentQueueStr) : [];
      
      const newRequest = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        endpoint,
        method,
        data,
        timestamp: new Date().toISOString(),
      };

      queue.push(newRequest);
      await storage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log(`📦 OfflineQueue: Cached request [${method}] to ${endpoint}. Queue size: ${queue.length}`);
      
      this.flush();
      return true;
    } catch (e) {
      console.error('📦 OfflineQueue: Failed to enqueue:', e);
      return false;
    }
  }

  /**
   * Retrieve all items in the queue
   */
  async getQueue() {
    try {
      const queueStr = await storage.getItem(QUEUE_KEY);
      return queueStr ? JSON.parse(queueStr) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear the queue
   */
  async clearQueue() {
    await storage.removeItem(QUEUE_KEY);
  }

  /**
   * Check connection status by pinging the backend health API
   */
  async isOnline() {
    try {
      const response = await axios.get(`${BASE_URL}/health`, { timeout: 3000 });
      return response.status === 200 && response.data?.status === 'OK';
    } catch {
      return false;
    }
  }

  /**
   * Flush queue using unified offlineSync engine
   */
  async flush() {
    return flushOfflineQueue();
  }

  startHealthCheckLoop() {}
  stopHealthCheckLoop() {}
}

export const offlineQueue = new OfflineQueue();
export default offlineQueue;
