const fs = require("fs-extra");
require('dotenv').config();
const parser = require("xml2json");
const path = require("path");
const {ROCrate} = require("ro-crate");

const metadataFilesDir = process.env.METADATADIR;

(async () => {
  const metadataFiles = await fs.readdir(metadataFilesDir);
  for (let file of metadataFiles) {
    try {
      const filePath = path.join(metadataFilesDir, file);
      const fileContents = await fs.readFile(filePath, "utf8");
      const json = parser.toJson(fileContents, {});
      const metadata = JSON.parse(json);
      const dataset = metadata["eml:eml"].dataset;
      const crate = new ROCrate();
      setRootData(crate, dataset);
      setHasPart(crate, dataset);
      const jsonCrate = crate.toJSON();
      console.log(jsonCrate);

    } catch (e) {
      console.log(e);
    }
  }
})();

function setRootData(crate, dataset) {
  const rootDataset = crate.getRootDataset();
  rootDataset.name = dataset.title;
  rootDataset.abstract = dataset.abstract.para;
  rootDataset.keywords = dataset?.keywordsSet?.keyword;
  rootDataset.intellectualRights = dataset.intellectualRights.para;
  rootDataset.temporalCoverage = dataset.coverage.temporalCoverage.singleDateTime.calendarDate;

  //TODO: add more to rootDataset;
  const salutation = dataset.creator.individualName.salutation;
  const givenName = dataset.creator.individualName.givenName;
  const surName = dataset.creator.individualName.surName;
  let name;
  if (salutation) {
    name = `${salutation} ${givenName} ${surName}`;
  } else {
    name = `${givenName} ${surName}`;
  }
  const author = {
    "@id": "",
    "@type": ["Person"],
    name
  }
  crate.addItem(author);
  const organization = {
    "@id": "QUT", //TODO: add orgs
    "@type": ["Organization"],
    "name": dataset.organizationName
  }
  crate.addItem(organization);
  const project = {
    "@id": dataset.project.title,
    "@type": ["Organization"],
    name: dataset.project.title,
    organization: organization["@id"]
  }
  crate.addItem(project);

}

function setHasPart(crate, dataset) {
  if (dataset.dataTable) {
    for (let dT of dataset.dataTable) {
      const part = {
        "@id": dT.physical.objectName,
        "@type": ["File"],
        name: dT.entityName,
        description: dT.entityDescription,
        size: dT.physical["$t"],
        emlName: dT.physical.distribution.online.url
      }
      crate.addValues(crate.rootDataset, 'hasPart', part);
    }
  }
}
