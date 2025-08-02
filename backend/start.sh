#!/bin/sh

# Wait for Kafka to be ready
echo "Waiting for Kafka..."
while ! nc -z kafka 29092; do
  sleep 1
done
echo "Kafka is up!"

# Wait for Cassandra to be ready
echo "Waiting for Cassandra..."
while ! nc -z cassandra 9042; do
  sleep 1
done
echo "Cassandra is up!"

# Wait for Redis to be ready
echo "Waiting for Redis..."
while ! nc -z redis 6379; do
  sleep 1
done
echo "Redis is up!"


echo "All services are ready. Starting application..."
# Start the consumer process in the background
node consumer.js &

# Start the API server in the foreground
node index.js