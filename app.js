// =============== Library imports ===============
const fs = require('fs').promises;
const path = require('path');
const convert = require('xml-js');
const processor = require('./processor.js');

// =============== Constants ===============

const VERSION = "1.2.0 DEBUG";

// =============== Application functions ===============

/**
 * @param  {} file The filename to be read.
 */
const readFile = (file) => {
  return fs.readFile(file, 'utf8')
    .catch(reason => console.error(`Unable to read file "${file}": ${reason}`));
};
/**
 * @param  {string} dir The directory to search for files in.
 * @param  {string} suffix The suffix to check files with, usually used to find a file extension.
 * @returns {Array.<string>} files The qualified paths to the files listed in the directory, in alphanumeric order.
 */
const findFilesInDir = (dir, suffix) => {
  return fs.readdir(dir)
    .then(value => {
      return value.filter(file => file.endsWith(suffix))
        .map(filename => path.format({
          dir: dir,
          base: filename
        }))
        .sort()
    })
    .catch(reason => console.error(`Unable to find files in directory "${dir}": ${reason}`));
};

/**
 * @param  {Array.<string>} files An array of files to be deleted.
 * @returns {Array.<Promise>} deletions - An array of deletion promises that will be fulfilled in the future.
 */
const deleteFiles = function (files) {
  return files.map(file => fs.unlink(file)
    .catch(reason => console.error(`Unable to delete file "${file}": ${reason}`)));
};

/**
 * @typedef {Object} InputArgs
 * @property {string} js - The relative or absolute path to the input library js file.
 * @property {string} jxmlDir - The relative or absolute path to the input jxml directory.
 * @property {string} cxmlDir - The relative or absolute path to the output cxml directory.
 * @property {string} inputXml - The relative or absolute path to the input xml file.
 * @property {string} outputXml - The relative or absolute path to the output xml file.
 * @property {number|string} spaces - The number of spaces to indent output cxml/xml with. May also accept \t for tabs.
 */

/**
 * @returns {InputArgs} args - The arguments to the application.
 */
const readArgs = function () {
  return {
    js: process.argv[2],
    jxmlDir: process.argv[3],
    cxmlDir: process.argv[4],
    inputXml: process.argv[5],
    outputXml: process.argv[6],
    spaces: isNaN(process.argv[7]) ? '\t' : Number(process.argv[7])
  };
};

/**
 * @param  {InputArgs} args - Arguments passed in from the program scope.
 */
const processArgs = async function (args) {
  return Promise.all([readFile(args.js), findFilesInDir(args.jxmlDir, ".jxml"), findFilesInDir(args.cxmlDir, ".cxml"), readFile(args.inputXml)])
  .catch(reason => console.error(`Unable to process all args: ${reason}`));
}
/**
 * @param  {Array.<string>} trashCxmls Array of paths to CXMLs to be deleted.
 */
const clearTrashCxmls = async function (trashCxmls) {
    if (trashCxmls.length > 0) {
      console.log(`Cleaning ${trashCxmls.length} CXML files...`);
  
      const waitForDelete = await Promise.all(deleteFiles(trashCxmls));
    }
}
/**
 * @param  {string} inputJs - The file contents of a library JS file for processing.
 * @param  {Array.<string>} inputJxmls - The qualified paths to JXMLs for processing.
 * @param  {string} cxmlDir - The directory to write new CXMLs to.
 * @param  {number|string} spaces - The number of spaces to indent new CXMLs with. May also use \t for tabs.
 */
const processAndWriteCxmls = async function (inputJs, inputJxmls, cxmlDir, spaces) {
  let writeCount = 0;
  const writeCxmlPromises = inputJxmls.map(async function (filepath) {
    const filename = path.basename(filepath, ".jxml");
    const file = await readFile(filepath);

    if (file == null)
      return;

    const output = processor.processJxml(inputJs, file);

    if (output == null)
      return;
    
    const cxmlPath = path.format({
      dir: cxmlDir,
      name: filename,
      ext: ".cxml"
    });

    // Convert output to JS Object and back to XML for formatting reasons
    const jsOutput = convert.xml2js(output);
    const formattedXml = convert.js2xml(jsOutput, { spaces: spaces });

    try {
      const waitForWrite = await fs.writeFile(cxmlPath, formattedXml);
      writeCount += 1;
    } catch (err) {
      console.error(`Unable to write data to "${cxmlPath}": ${err}`);
    }
  });

  const writeCxmlCompletion = await Promise.all(writeCxmlPromises);

  return writeCount;
}

/**
 * @param  {string} cxmlDir - The directory containing processed cxmls
 * @param  {string} xml - The file contents of the XML file to copy from.
 * @param  {string} xmlPath - The file path to write the new edited contents into.
 * @param  {number|string} spaces - The number of spaces to indent new XML with. May also use \t for tabs.
 */
const copyCxmls = async function (cxmlDir, xml, xmlPath, spaces) {
  const cxmls = await findFilesInDir(cxmlDir, ".cxml");
  console.log(`Writing ${cxmls.length} cxmls to "${xmlPath}"...`);

  // scratch space for writing in xml changes before writing to file.
  let xmlBuffer = xml;
  for (let i = 0; i < cxmls.length; i++) {
    console.log(`Writing "${cxmls[i]}" to xml...`);
    const cxmlFilename = path.basename(cxmls[i]);
    const cxml = await readFile(cxmls[i]);

    if (cxml == null) {
      console.error(`Unable to read cxml "${cxmls[i]}". Moving to next cxml...`);
      continue;
    }
    
    // Search for the following strings in the XML
    const startFilename = `<!-- START(${cxmlFilename}) -->`;
    const endFilename = `<!-- END(${cxmlFilename}) -->`;

    // First character of the starting position.
    const startPosition = xmlBuffer.indexOf(startFilename);
    // First character of the ending position;
    const endPosition = xmlBuffer.lastIndexOf(endFilename);

    if (startPosition === -1 || endPosition === -1) {
      console.error(`Includes startFilename: ${xmlBuffer.includes(startFilename)}`);
      console.error(`Includes endFilename: ${xmlBuffer.includes(endFilename)}`);
      console.error(`startPosition: ${startPosition}`);
      console.error(`endPosition: ${endPosition}`);
      console.error(`Unable to find a well-formed start and end sequence for "${cxmlFilename}" in the XML. Moving on to next cxml...`);
      continue;
    }

    const startObjects = "<Objects>";
    const endObjects = "</Objects>";

    const startObjPosition = cxml.indexOf(startObjects);
    const endObjPosition = cxml.lastIndexOf(endObjects);

    // By default, copy the entire cxml.
    let copiedCxml = cxml;

    // Unless we find the <Objects> tags, which we wanna remove.
    if (startPosition !== -1 && endObjPosition !== -1) {
      let startInnerPosition = startObjPosition + startObjects.length;
      
      // If the character right after the start object is NOT the start of the end object
      // then we have characters inside we need to copy.
      if (startInnerPosition < endObjPosition) {
        copiedCxml = cxml.substring(startInnerPosition, endObjPosition);
      } else {
        // Nothing to copy.
        copiedCxml = "";
      }
    }

    const xmlStringToReplace = xmlBuffer.substring(startPosition, endPosition + endFilename.length);
    const newXmlString = startFilename + "\n" + copiedCxml + "\n" + endFilename;

    xmlBuffer = xmlBuffer.replace(xmlStringToReplace, newXmlString);
  }

  // Convert to JS Object and back to XML for formatting reasons
  const jsObject = convert.xml2js(xmlBuffer);
  const formattedXml = convert.js2xml(jsObject, { spaces: spaces });

  try {
    await fs.writeFile(xmlPath, formattedXml);
  } catch (err) {
    console.error(`Unable to write resulting XML into "${xmlPath}": ${err}`);
  }
}

// =============== Start of execution ===============
const main = async function () {
  console.log(`JXML Processor version ${VERSION}`);

  const args = readArgs();
  const [inputJs, inputJxmls, trashCxmls, inputXml] = await processArgs(args);

  if (inputJs == null || inputJxmls == null || trashCxmls == null || inputXml == null) {
    console.error("Aborting process due to bad arguments.");
    return;
  }

  console.log(`Input JS Library: ${Buffer.byteLength(inputJs, "utf8")} bytes`);
  console.log(`Input XML File: ${Buffer.byteLength(inputXml, "utf8")} bytes`);

  if (inputJxmls.length == null || inputJxmls.length == 0) {
    console.log("Found no input JXMLs to preprocess! Aborting.");
    return;
  }

  console.log(`Found ${inputJxmls.length} input JXML files.`);
  await clearTrashCxmls(trashCxmls);

  const successfulWriteCount = await processAndWriteCxmls(inputJs, inputJxmls, args.cxmlDir, args.spaces);
  console.log(`Successfully wrote ${successfulWriteCount} CXMLs.`);

  await copyCxmls(args.cxmlDir, inputXml, args.outputXml, args.spaces);

  try {
    const newXml = await readFile(args.outputXml);
    const newXmlLen = Buffer.byteLength(newXml);
    console.log(`Output XML File: ${newXmlLen} bytes`);
  } catch (err) {
    console.error(`Unable to read new XML file at "${args.outputXml}": ${err}`);
  }
}

module.exports = { main };