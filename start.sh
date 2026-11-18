#!/bin/bash

# Start both Laravel and Vite dev servers concurrently
# Usage: bash start.sh

php artisan serve &
npm run dev
