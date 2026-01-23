import mongoose from 'mongoose'
import { MONGODB_URI } from './env'

/**
 * MongoDB connection configuration
 * Connects to MongoDB Atlas using connection string from environment variables
 */

let isConnected = false

/**
 * Connect to MongoDB Atlas
 * This function should be called once when the server starts
 */
export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    console.log('📦 MongoDB already connected')
    return
  }

  if (!MONGODB_URI) {
    console.error('❌ Cannot connect to MongoDB: MONGODB_URI is not set')
    return
  }

  try {
    // const options: mongoose.ConnectOptions = {
    //   useNewUrlParser: true, // Recommended for older Mongoose versions
    //   useUnifiedTopology: true, // Recommended for older Mongoose versions
    // }
    console.log('🔄 Attempting to connect to MongoDB...')
    console.log("mongodb uri", MONGODB_URI)
    await mongoose.connect(MONGODB_URI)

    // Wait for connection to be fully ready
    if (mongoose.connection.readyState !== 1) {
      // Wait a bit for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    isConnected = true
    const dbName = mongoose.connection.db?.databaseName || 'rentany_platform'
    const readyState = mongoose.connection.readyState
    console.log(`✅ Connected to MongoDB Atlas`)
    console.log(`📦 Database: ${dbName}`)
    console.log(`📋 Collection: users`)
    console.log(`🔌 Connection state: ${readyState} (1 = connected)`)
    
    // Verify connection with a test query
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping()
        console.log(`✅ MongoDB connection verified (ping successful)`)
      } else {
        console.warn(`⚠️  MongoDB connection.db is undefined`)
      }
    } catch (pingError) {
      console.warn(`⚠️  MongoDB ping failed:`, pingError)
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err)
      isConnected = false
    })

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected')
      isConnected = false
    })

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected')
      isConnected = true
    })

  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error)
    isConnected = false
    throw error
  }
}

/**
 * Disconnect from MongoDB
 * Useful for graceful shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return
  }

  try {
    await mongoose.disconnect()
    isConnected = false
    console.log('📦 Disconnected from MongoDB')
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error)
    throw error
  }
}

/**
 * Check if database is connected
 * readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
export function isDatabaseConnected(): boolean {
  const readyState = mongoose.connection.readyState
  const connected = readyState === 1 // 1 = connected
  
  if (!connected) {
    console.warn(`⚠️  MongoDB connection state: ${readyState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`)
  }
  
  return connected
}

export default mongoose
