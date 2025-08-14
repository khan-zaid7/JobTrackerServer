import amqp from 'amqplib';

// THE CENTRAL POST OFFICE.
export const PIPELINE_EXCHANGE = 'pipeline_exchange';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

let connection = null;
let channel = null;

export async function connectToQueue() {
    if (connection) return;
    try {
        console.log(`[RabbitMQ] Attempting to connect...`);
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        // ✨ THE FIX: USE A 'direct' EXCHANGE FOR PRECISE ROUTING. ✨
        // This allows us to use routing keys as addresses.
        await channel.assertExchange(PIPELINE_EXCHANGE, 'topic', { durable: true });

        console.log(`[RabbitMQ] Connection successful. Exchange "${PIPELINE_EXCHANGE}" is ready.`);
    } catch (error) {
        console.error(`[RabbitMQ] FATAL: Could not connect to RabbitMQ.`, error);
        process.exit(1);
    }
}

// Publish a message to the central exchange with a specific address.
export async function publishToExchange(routingKey, message) {
    if (!channel) throw new Error(`RabbitMQ channel not available.`);
    try {
        // ✨ THE FIX: Correctly pass the 'persistent' option. ✨
        channel.publish(PIPELINE_EXCHANGE, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
    } catch (error) {
        console.error(`[RabbitMQ] Failed to publish message with routing key ${routingKey}:`, error);
    }
}

// ✨ THE FIX: THE COMPLETE, CORRECTED CONSUMER FUNCTION. ✨
// It now correctly accepts and uses the messageHandler callback.
export async function consumeFromExchange(routingKey, messageHandler) {
    if (!channel) throw new Error('RabbitMQ channel not available.');
    
    // Create an exclusive, auto-deleting queue for this worker instance.
    // ✨ THE FIX: Corrected typo from autoDetele to autoDelete. ✨
    const { queue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });
    
    // Bind the private queue to the exchange, telling it which address to listen for.
    await channel.bindQueue(queue, PIPELINE_EXCHANGE, routingKey);
    
    console.log(`[Worker] Listening for messages with address "${routingKey}" on private queue "${queue}"`);
    
    // Consume from the private queue.
    channel.consume(queue, messageHandler, { noAck: false });
}


export async function consumeFromCampaignQueue(baseName, campaignId, messageHandler) {
    if (!channel) throw new Error('RabbitMQ channel not available.');

    // 1. Define a SHARED, DURABLE queue name for the campaign.
    // e.g., "q.tailor.campaign_123"
    const queueName = `q.${baseName}.${campaignId}`;
    // 2. Create the shared queue.
    await channel.assertQueue(queueName, { durable: true });
    
    // 3. Define the routing key pattern for this queue.
    // e.g., "tailor.campaign_123"
    const routingKey = `${baseName}.${campaignId}`;
    
    // 4. Bind the shared queue to the exchange with the routing key.
    await channel.bindQueue(queueName, PIPELINE_EXCHANGE, routingKey);
    
    console.log(`[Worker] Listening on SHARED queue "${queueName}" for messages with address "${routingKey}"`);
    
    // 5. All workers consume from the SAME shared queue.
    channel.consume(queueName, messageHandler, { noAck: false });
}

// Unchanged but necessary functions.
export function getChannel() {
    return channel;
}

export async function closeQueueConnection() {
    if (channel) {
        await channel.close();
        channel = null;
    }
    if (connection) {
        await connection.close();
        connection = null;
    }
    console.log('[RabbitMQ] Connection closed gracefully.');
}