const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CSV_FILE_PATH = path.join(__dirname, '..', 'seethis', 'yellow_tripdata_2015-01.csv');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'chunks');
const ROWS_PER_CHUNK = 10000; // Number of rows per chunk
const MAX_CHUNKS = Infinity; // Set a limit if needed, or Infinity for all

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Function to process the CSV data
async function processCSV() {
  console.log(`Processing CSV file: ${CSV_FILE_PATH}`);
  console.log(`Chunk size: ${ROWS_PER_CHUNK} rows per chunk`);
  
  // Create a readable stream
  const fileStream = fs.createReadStream(CSV_FILE_PATH);
  
  // Create interface to read line by line
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let headers = [];
  let currentChunk = [];
  let chunkIndex = 0;
  let rowCount = 0;
  let totalRows = 0;
  
  console.log('Reading CSV file...');
  
  for await (const line of rl) {
    // Skip empty lines
    if (!line.trim()) continue;
    
    // Parse the first line as headers
    if (rowCount === 0) {
      headers = line.split(',');
      rowCount++;
      continue;
    }
    
    // Parse CSV row into object
    const values = parseCSVLine(line);
    
    // If there aren't enough values, log and skip
    if (values.length !== headers.length) {
      console.warn(`Line ${totalRows + 1} has ${values.length} values, expected ${headers.length}. Skipping.`);
      continue;
    }
    
    // Create an object from headers and values
    const row = {};
    headers.forEach((header, i) => {
      // Convert numeric values
      const value = values[i];
      if (!isNaN(value) && value !== '') {
        row[header] = Number(value);
      } else {
        row[header] = value;
      }
    });
    
    // Add to current chunk
    currentChunk.push(row);
    rowCount++;
    totalRows++;
    
    // When chunk is full, write to file
    if (currentChunk.length >= ROWS_PER_CHUNK) {
      await writeChunkToFile(currentChunk, chunkIndex);
      currentChunk = [];
      chunkIndex++;
      
      // Check if we've reached the maximum number of chunks
      if (chunkIndex >= MAX_CHUNKS) {
        console.log(`Reached maximum number of chunks (${MAX_CHUNKS}). Stopping.`);
        break;
      }
    }
    
    // Log progress every 100,000 rows
    if (totalRows % 100000 === 0) {
      console.log(`Processed ${totalRows} rows...`);
    }
  }
  
  // Write the remaining chunk if not empty
  if (currentChunk.length > 0) {
    await writeChunkToFile(currentChunk, chunkIndex);
    chunkIndex++;
  }
  
  console.log(`Completed! Processed ${totalRows} rows total.`);
  console.log(`Created ${chunkIndex} chunks in ${OUTPUT_DIR}`);
}

// Helper function to parse CSV line properly handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push the last field
  result.push(current);
  
  return result;
}

// Write chunk to JSON file
async function writeChunkToFile(data, index) {
  const fileName = `chunk-${String(index).padStart(5, '0')}.json`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), err => {
      if (err) {
        console.error(`Error writing chunk ${index}:`, err);
        reject(err);
      } else {
        console.log(`Wrote chunk ${index}: ${filePath}`);
        resolve();
      }
    });
  });
}

// Run the process
processCSV().catch(err => {
  console.error('Error processing CSV:', err);
  process.exit(1);
});
