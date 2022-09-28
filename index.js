const {Collector, generateArcpId} = require("oni-ocfl");
const fs = require("fs-extra");
require('dotenv').config();
const parser = require("xml2json");
const path = require("path");
const {ROCrate} = require("ro-crate");

const metadataFilesDir = process.env.METADATADIR;

(async () => {
  const collector = new Collector();
  await collector.connect(); // Make or find the OCFL repo
  const licensesFile = await fs.readFile("./licenses.json", "utf8");
  const licenses = JSON.parse(licensesFile);

  const metadataFiles = await fs.readdir(metadataFilesDir);
  for (let file of metadataFiles) {
    const filePath = path.join(metadataFilesDir, file);
    let metadata;
    try {
      const fileContents = await fs.readFile(filePath, "utf8");
      const json = parser.toJson(fileContents, {});
      metadata = JSON.parse(json);
    } catch (e) {
      console.log(e)
      console.log("error")
      console.log(filePath);
      debugger
      continue;
    }
    metadata = metadata["eml:eml"];
    const pack = metadata.packageId.split(/\./);
    const packId = `${pack[0]}.${pack[1]}.${pack[2]}`;
    const packVersion = pack[2]

    const package = collector.newObject();
    const crate = package.crate;
    crate.rootDataset["@type"] = ["Dataset", "RepositoryCollection"];
    crate.rootDataset.conformsTo = [{"@id": "n2o.net.au/collection"}];
    package.mintArcpId("package", packId);
    setLicense(crate, metadata.access, licenses);
    setRootData(crate, metadata.dataset);
    setHasPart(crate, metadata.dataset);
    const jsonCrate = crate.toJSON();
    console.log(jsonCrate);
    try {
      await package.addToRepo();

    } catch (e) {
      console.log(jsonCrate);
      debugger;
      throw new Error(e);
    }
  }
})();

function setRootData(crate, dataset) {
  const rootDataset = crate.getRootDataset();
  rootDataset.name = dataset.title;
  rootDataset.abstract = dataset.abstract?.para;
  rootDataset.keywords = dataset?.keywordsSet?.keyword;
  rootDataset.intellectualRights = dataset.intellectualRights?.para;
  rootDataset.temporalCoverage = dataset.coverage?.temporalCoverage?.singleDateTime?.calendarDate;

  //TODO: add more to rootDataset;
  const creators = crate.utils.asArray(dataset.creator)
  for (let creator of creators) {
    const salutation = creator.individualName?.salutation;
    const givenName = creator.individualName?.givenName;
    const surName = creator.individualName?.surName;
    let name;
    if (salutation) {
      name = `${salutation} ${givenName} ${surName}`;
    } else if (givenName && surName) {
      name = `${givenName} ${surName}`;
    } else if (surName) {
      name = surName;
    } else {
      name = undefined;
    }
    let author;
    if (name) {
      author = {
        "@id": creator.id,
        "@type": ["Person"],
        name
      }
    } else {
      author = {"@id": creator.id}
    }
    crate.addItem(author);
  }
  const organization = {
    "@id": "QUT", //TODO: add orgs
    "@type": ["Organization"],
    "name": dataset.organizationName
  }
  crate.addItem(organization);
  if (dataset.project?.title) {
    const project = {
      "@id": dataset.project?.title,
      "@type": ["Organization"],
      name: dataset.project.title,
      organization: organization["@id"]
    }
    crate.addItem(project);
  }
}

function setHasPart(crate, dataset) {
  if (dataset.dataTable) {
    const dataTable = crate.utils.asArray(dataset.dataTable)
    for (let dT of dataTable) {
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

function setLicense(crate, access, licenses) {
  let license;
  if (access) {
    if (access["allow"] && access["allow"]["principal"] === "public") {
      license = licenses["public"];
      crate.addValues(crate.rootDataset, 'license', license);
    }
  } else {
    license = licenses["private"];
    crate.addValues(crate.rootDataset, 'license', license);
  }
}
