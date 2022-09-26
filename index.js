const {Collector, generateArcpId} = require("oni-ocfl");
const fs = require("fs-extra");


(async () => {
  const collector = new Collector(); // Get all the paths etc from commandline
  await collector.connect();
  // Generate csv file of each raw file
  console.log("Generating csv files of raw files!!")
  const files = await fs.readdir(collector.dataDir);
})();
