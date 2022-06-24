# This tool is a JS-based templating engine, intended to be used to programmatically template XML files.

## Explanation

A JS file is used for holding functions that are shared across multiple JXML files. This is often referred to as the library file, or JS library. Functions that should be exposed to the templating code should be declared with `var` syntax, due to the implementation of scope in this engine. All visible functions and variables are declared in the global scope.

A JXML file is simply an XML file that contains JS-based template code. The following syntax is added to JXML:
  - `{ sample.printCode() }` indicate a section of JS code that evaluates to a string which is printed out in the final output.
  - `{! sample.onlyRunCode() }` indicates a section of JS code that is evaluated within the current scope but does not print any output. This is useful for creating functions and writing comments at the pre-template level. Similar to functions in the JS library, these are also declared in the global scope, however this is only useful for templating within the file. 

Aside from that, JXML possesses identical syntax to XML. However, due to these notable changes, JXML cannot be normally formatted/verified by XML parsers/linters. At the moment, any verification of correct formatting and indentation must be done by hand.

A CXML file is simply the processed output of a JXML file. It is identical to XML.

CXML files will be combined into a single XML file to assist with the workflow this tool was designed for. The Input XML requires the following comments added to a section for the code to appear:

```xml
<!-- START(filename.cxml) -->

<!-- END(filename.cxml) -->
```

Whatever is between these two tags will be replaced by the CXML- so for templates, it's recommended to just leave it empty.

Once setup is complete, you can use this application, ideally with a batch script to minimize busywork, to automate the templating process.

## Usage

### Build

This project requires [Node.js](https://nodejs.org/en/download/). The last working build was built with Node.js `v18.0.0`, however it should work with most versions.

`npm run build` in the repository root will compile the binary, `jxml-processor.exe`.

### Running the Application

The usage of this application is as follows:

`jxml-processor.exe <js> <jsDir> <jxmlDir> <cxmlDir> <inputXml> <outputXml> <spaces> <startString> <endString>`
  - `js`: The relative or fully qualified path to the JS library file.
  - `jsDir`: The relative or absolute path to the input js directory.
  - `jxmlDir`: The relative or fully qualified path to the directory containing your JXMLs. This is not a recursive search.
  - `cxmlDir`: The relative or fully qualified path to the directory containing your CXMLs. This is not a recursive search.
  - `inputXml`: The relative or fully qualified path to the input XML. This can be the same as `outputXml`.
  - `outputXml`: The relative or fully qualified path to the output XML. This can be the same as `inputXml`.
  - `spaces`: The number of spaces to indent CXML/XML with. This will default to tabs.'
  - `startString`: A unique string to be located in cxml that indicates the start of the text to copy, exclusive of the string itself.
  - `endString`: A unique string to be located in cxml that indicates the end of the text to copy, exclusive of the string itself.

The JS library file should be any central code that you wish to share across all files, while the JS directory is for individual JS files that will only be processed with a JXML of the same filename.

It's recommended to store JXMLs and CXMLs in their own separate subdirectories. Files without the `.jxml` or `.cxml` extension will be ignored. In addition, it's recommended to avoid doing work in the CXML directory, as `.cxml`s in the CXML directory will be deleted before each process- this is to allow easier renames of JXMLs without having to clean this intermediate directory.

All errors should be logged out to the console in a useful way, but if you need more help, contact me!

### Sample Directory

The `sample` folder contains a project structure valid for this templating engine.

You can run this script in the repository root to process the sample directory:
`npm run test`

## Adding Scripts

All JS should declare functions/variables in the global scope using `var`. Variables inside functions may remain whatever scope is suitable for the use case.

### Library File

The library file may be executed multiple times. It executes once for each JXML file that gets processed.
As long as your variables are declared with `var`, the redeclarations should not output any errors.

For state that needs to persist across JXML files (such as an object types dictionary), use a singleton-esque code block where you check for the state being initialized before running initialization code.

```js
// scriptsLibrary.js

if (importantState == null) {
  var importantState = initialize();
}
```

### JS Directory Files

Each of these execute only once, but they create variables in the global scope that can be read from other files. To avoid this, specify a global object that parents all the state/functions local to this file.

```js
// testContent.js

var TestContent = {};

TestContent.LocalVariable = 123;

TestContent.LocalFunction = (input) => {
  return TestContent.LocalVariable + input;
}
```
