import mongoose from 'mongoose';
/**
 * Connect to MongoDB Atlas
 * This function should be called once when the server starts
 */
export declare function connectDatabase(): Promise<void>;
/**
 * Disconnect from MongoDB
 * Useful for graceful shutdown
 */
export declare function disconnectDatabase(): Promise<void>;
/**
 * Check if database is connected
 * readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
export declare function isDatabaseConnected(): boolean;
export default mongoose;
//# sourceMappingURL=database.d.ts.map