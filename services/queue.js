import amqp from 'amqplib';

// defining the queue names 
export const NEW_JOB_QUEUE = 'new-job-queue';
export const TAILORING_QUEUE = 'tailoring-queue';

// using .env for configs 
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

// using singlton pattern 
let connection = null;
let channel = null;

// connect to the mq_server and asset the queues 
export async function connectToQueue(){
    // if we are already connected do nothing
    if (connection){
        return;
    }

    try {
        console.log(`[RabbitMQ attempting to connect...]`);
        connection = await amqp.connect(RABBITMQ_URL);

        connection.on('error', (err) => {
            console.error('[RabbitMQ] Connection error', err);
            // reconnection logic here 
        })

        connection.on('close', () => {
            console.warn(`[RabbitMQ] connection closed.`);
            channel = null;
            connection = null;
        })

        channel = await connection.createChannel();
        console.log('[RabbitMQ] connection successfull, channel created!');

        // Asserting queues (if it does not exist then it creates the queue)
        // durable makes sure that queue survives when RabbitMQ restarts 
        await channel.assertQueue(NEW_JOB_QUEUE, {durable: true});  
        await channel.assertQueue(TAILORING_QUEUE, {durable: true});

        console.log(`[RabbitMQ] queues ${NEW_JOB_QUEUE}, ${TAILORING_QUEUE} created successfully.`);
    }
    catch (error){
        console.error(`[RabbitMQ] FATAL: could not connect to RabbitMQ.`, error);
        process.exit(1);
    } 
}


/**
 * This function publishes a message to a specific queue.
 * @param {string} queueName - The name of the queue to publish to.
 * @param {object} message - The JSON object to send.
 */
export async function publishToQueue(queueName, message){
    if (!channel){
        throw new Error(`RabbitMQ channel not available.`);
    }

    try{
        // send the message as a buffer of stringified JSON object
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
            persistent: true
        });
    }
    catch (error) {
        console.error(`[RabbitMQ] failed to publish message to queue ${queueName}:`, error);
        //  attempt to recconect 
    }
}

/**
 * Gracefully closes the RabbitMQ connection.
 * This should be called when a service is shutting down.
 */
export async function closeQueueConnection(){
    if (channel){
        await channel.close();
        channel = null;
    }

    if (connection){
        await connection.close();
        connection = null;
    }

    console.log('[RabbitMQ] Connection closed gracefully.');
}

/**
 * Provides direct access to the channel for more advanced consumer logic.
 * @returns {amqp.Channel | null} The amqplib channel object.
 */
export function getChannel() {
    return channel;
}