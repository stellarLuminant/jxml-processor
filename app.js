// =============== Library imports ===============
const fs = require('fs').promises;
const path = require('path');
const convert = require('xml-js');
const processor = require('./processor.js');

// =============== Constants ===============

const VERSION = "1.3.0";

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
 * @property {string} jsDir - The relative or absolute path to the input js directory.
 * @property {string} jxmlDir - The relative or absolute path to the input jxml directory.
 * @property {string} cxmlDir - The relative or absolute path to the output cxml directory.
 * @property {string} inputXml - The relative or absolute path to the input xml file.
 * @property {string} outputXml - The relative or absolute path to the output xml file.
 * @property {number|string} spaces - The number of spaces to indent output cxml/xml with. May also accept \t for tabs.
 * @property {string} startString - A unique string to be located in cxml that indicates the start of the text to copy, exclusive of the string itself.
 * @property {string} endString - A unique string to be located in cxml that indicates the end of the text to copy, exclusive of the string itself.
 */

/**
 * @returns {InputArgs} args - The arguments to the application.
 */
const readArgs = function () {
  return {
    js: process.argv[2],
    jsDir: process.argv[3],
    jxmlDir: process.argv[4],
    cxmlDir: process.argv[5],
    inputXml: process.argv[6],
    outputXml: process.argv[7],
    spaces: isNaN(process.argv[8]) ? '\t' : Number(process.argv[8]),
    startString: process.argv[9],
    endString: process.argv[10]
  };
};

/**
 * @param  {InputArgs} args - Arguments passed in from the program scope.
 */
const processArgs = async function (args) {
  return Promise.all([readFile(args.js), findFilesInDir(args.jsDir, ".js"), findFilesInDir(args.jxmlDir, ".jxml"), findFilesInDir(args.cxmlDir, ".cxml"), readFile(args.inputXml)])
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
 * @param  {string} libJs - The file contents of a library JS file for processing.
 * @param  {string} jsPath - The qualified path for the JS to process.
 * @param  {string} jxmlPath - The qualified path for the JXML to process.
 * @param  {string} cxmlDir - The directory to write a new CXML to.
 * @param  {number|string} spaces - The number of spaces to indent the new CXML with. May also use \t for tabs.
 */
const processAndWriteCxml = async function (libJs, jsPath, jxmlPath, cxmlDir, spaces) {
  const filename = path.basename(jxmlPath, ".jxml");
  const jsFile = await readFile(jsPath);
  const jxmlFile = await readFile(jxmlPath);

  if (jsFile == null)
    return Promise.reject(`Unable to read file "${jsPath}"`);
  if (jxmlFile == null)
    return Promise.reject(`Unable to read file "${jxmlPath}"`);

  const output = processor.processJxml(libJs, jsFile, jxmlFile);

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
    await fs.writeFile(cxmlPath, formattedXml);
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(`Unable to write data to "${cxmlPath}": ${err}`);
  }
}

/**
 * @param  {string} libJs - The file contents of a library JS file for processing.
 * @param  {Array.<string>} inputJs - The qualified paths to JS files for processing.
 * @param  {Array.<string>} inputJxmls - The qualified paths to JXMLs for processing.
 * @param  {string} cxmlDir - The directory to write new CXMLs to.
 * @param  {number|string} spaces - The number of spaces to indent new CXMLs with. May also use \t for tabs.
 */
const processAndWriteCxmls = async function (libJs, inputJs, inputJxmls, cxmlDir, spaces) {
  let writeCount = 0;

  let inputs = [];

  for (let i = 0; i < inputJxmls.length; i++) {
    const jxmlPath = inputJxmls[i];
    const jxmlFilename = path.basename(jxmlPath, ".jxml");
    const jsFilename = jxmlFilename + ".js";

    const matches = inputJs.filter(jsPath => jsPath.includes(jsFilename));
    if (matches == 0) {
      console.error(`Unable to find JS file "${jsFilename}" matching "${jxmlPath}."`);
    }

    if (matches > 1) {
      console.error(`Multiple matches found for JS file "${jsFilename}" matching "${jxmlPath}."`);
      matches.forEach(match => console.error(`    ${match}`));
    }

    const jsPath = matches[0] ?? "";

    inputs.push({ jxmlPath, jsPath });
  }

  const processAndCount = async function (paths) {
    const { jsPath, jxmlPath } = paths;
    try {
      await processAndWriteCxml(libJs, jsPath, jxmlPath, cxmlDir, spaces);
      writeCount++;
    } catch (err) {
      console.error(err);
    }
  }

  await inputs.reduce((promiseChain, paths) => promiseChain.then(() => processAndCount(paths)), Promise.resolve());

  return writeCount;
}

/**
 * @param  {string} cxmlDir - The directory containing processed cxmls
 * @param  {string} xml - The file contents of the XML file to copy from.
 * @param  {string} xmlPath - The file path to write the new edited contents into.
 * @param  {number|string} spaces - The number of spaces to indent new XML with. May also use \t for tabs.
 * @param  {string} startString - A unique string to be located in the file that indicates the start of the text to copy, exclusive of the string itself.
 * @param  {string} endString - A unique string to be located in the file that indicates the end of the text to copy, exclusive of the string itself.
 */
const copyCxmls = async function (cxmlDir, xml, xmlPath, spaces, startString, endString) {
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

    const startObjPosition = cxml.indexOf(startString);
    const endObjPosition = cxml.lastIndexOf(endString);

    // By default, copy the entire cxml.
    let copiedCxml = cxml;

    // Unless we find the startString, which we wanna remove.
    if (startPosition !== -1 && endObjPosition !== -1) {
      let startInnerPosition = startObjPosition + startString.length;
      
      // If the character right after the startString is NOT the start of the endString
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
  const [libJs, inputJs, inputJxmls, trashCxmls, inputXml] = await processArgs(args);

  if (libJs == null || inputJs == null || inputJxmls == null || trashCxmls == null || inputXml == null) {
    console.error("Aborting process due to bad arguments.");
    return;
  }

  console.log(`Lib JS Library: ${Buffer.byteLength(libJs, "utf8")} bytes`);
  console.log(`Input XML File: ${Buffer.byteLength(inputXml, "utf8")} bytes`);

  if (inputJxmls.length == null || inputJxmls.length == 0) {
    console.log("Found no input JXMLs to preprocess! Aborting.");
    return;
  }

  console.log(`Found ${inputJxmls.length} input JXML files.`);
  await clearTrashCxmls(trashCxmls);

  const successfulWriteCount = await processAndWriteCxmls(libJs, inputJs, inputJxmls, args.cxmlDir, args.spaces);
  console.log(`Successfully wrote ${successfulWriteCount} CXMLs.`);

  await copyCxmls(args.cxmlDir, inputXml, args.outputXml, args.spaces, args.startString, args.endString);

  try {
    const newXml = await readFile(args.outputXml);
    const newXmlLen = Buffer.byteLength(newXml);
    console.log(`Output XML File: ${newXmlLen} bytes`);
  } catch (err) {
    console.error(`Unable to read new XML file at "${args.outputXml}": ${err}`);
  }
}

module.exports = { main };