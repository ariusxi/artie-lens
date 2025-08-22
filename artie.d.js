'use strict';

var path = require('path');
var fs = require('fs');
var fg = require('fast-glob');
var colorette = require('colorette');
var tsMorph = require('ts-morph');
var tsmetricsCore = require('tsmetrics-core');
var typescript = require('typescript');

const configTemplate = {
    options: {
        defaultThresholds: {
            warning: 10,
            critical: 20,
            levels: ["OK", "WARNING", "ERROR"]
        },
        metrics: {
            lcom: {
                enabled: true,
                warning: 5,
                critical: 10
            },
            wmc: {
                enabled: true,
                warning: 10,
                critical: 25
            },
            rfc: {
                enabled: true,
                warning: 15,
                critical: 30
            },
            cbo: {
                enabled: true
            }
        }
    },
    includes: ['**/*.ts', '!**/*.d.ts'],
    excludes: [
        "**/*.test.ts",
        "node_modules",
        "dist",
        "scripts/**"
    ]
};

async function getSourceFiles(directory, includes, excludes) {
    return await fg(includes, {
        cwd: directory,
        absolute: true,
        onlyFiles: true,
        followSymbolicLinks: false,
        ignore: excludes,
    });
}
function readFileContent(directory) {
    return fs.readFileSync(directory, 'utf-8');
}
function printMetric(value, label) {
    const colorFn = {
        'OK': colorette.green,
        'WARNING': colorette.yellow,
        'CRITICAL': colorette.red
    };
    const color = colorFn[label];
    console.log(color(value));
}
function getProjectConfigPath(directory) {
    const configFile = fs.readdirSync(directory).find((file) => {
        return file.startsWith('tsconfig') && file.endsWith('.json');
    });
    if (!configFile) {
        throw new Error('⚠️ tsconfig.json not found.');
    }
    return path.join(directory, configFile);
}
function getProjectTarget(configContent) {
    const configs = JSON.parse(configContent);
    const target = configs.compilerOptions.target;
    return typescript.ScriptTarget[target] ?? typescript.ScriptTarget.ES2015;
}
function getCompilerOptions(configPath) {
    const configFile = typescript.readConfigFile(configPath, typescript.sys.readFile);
    if (configFile.error) {
        throw new Error(`Failed to read tsconfig.json: ${configFile.error.messageText}`);
    }
    const projectConfig = typescript.parseJsonConfigFileContent(configFile.config, typescript.sys, path.resolve(configPath));
    return projectConfig.options;
}
function getSourceFileByPath(filePath, program) {
    return program.getSourceFiles().find((file) => file.fileName === filePath);
}
function addClassDependencyFromSymbol(symbol, dependencies) {
    const name = symbol.getName();
    const declarations = symbol.getDeclarations();
    if (!declarations && !dependencies.has(name)) {
        dependencies.add(name);
        return;
    }
    for (const declaration of declarations) {
        if (typescript.isClassDeclaration(declaration) && declaration.name) {
            const className = declaration.name.text;
            dependencies.add(className);
            return;
        }
    }
}
function addClassDependencies(property, typeChecker, dependencies) {
    const type = typeChecker.getTypeAtLocation(property);
    const symbol = type.getSymbol();
    if (symbol)
        addClassDependencyFromSymbol(symbol, dependencies);
}
function collectClassDependencies(sourceFile, typeChecker) {
    const dependencies = new Set();
    typescript.forEachChild(sourceFile, (node) => {
        if (typescript.isClassDeclaration(node) && node.name) {
            node.members.forEach((member) => {
                if (typescript.isConstructorDeclaration(member)) {
                    member.parameters.forEach((parameter) => addClassDependencies(parameter, typeChecker, dependencies));
                }
                if (typescript.isPropertyDeclaration(member) && member.initializer) {
                    addClassDependencies(member.initializer, typeChecker, dependencies);
                }
                if (node.heritageClauses) {
                    node.heritageClauses.forEach((clause) => {
                        clause.types.forEach((type) => addClassDependencies(type, typeChecker, dependencies));
                    });
                }
            });
        }
    });
    return dependencies;
}
function getMetricLabel(total, metricConfig) {
    if (total >= metricConfig.critical)
        return 'CRITICAL';
    if (total >= metricConfig.warning)
        return 'WARNING';
    return 'OK';
}
function getClassDependenciesLength(filePath, program) {
    const sourceFile = getSourceFileByPath(filePath, program);
    if (!sourceFile)
        return 0;
    const typeChecker = program.getTypeChecker();
    const dependencies = collectClassDependencies(sourceFile, typeChecker);
    return dependencies.size;
}
function getFunctionsLength(fileContent) {
    const regex = /\bfunction\b|\bclass\b.*\b\w+\s*\(/g;
    const matches = fileContent.match(regex);
    return matches ? matches.length : 0;
}
function getCohesionLength(classDeclaration) {
    const methods = classDeclaration.getMethods();
    const properties = classDeclaration
        .getProperties()
        .map((property) => property.getName());
    if (methods.length < 2)
        return 0;
    const methodProperties = methods.map((method) => {
        const body = method.getBodyText() ?? '';
        return properties.filter((property) => body.includes(`this.${property}`));
    });
    let shared = 0;
    let unshared = 0;
    for (let i = 0; i < methodProperties.length; i++) {
        for (let j = i + 1; j < methodProperties.length; j++) {
            const intersection = methodProperties[i].filter((property) => methodProperties[j].includes(property));
            if (intersection.length > 0)
                shared++;
            else
                unshared++;
        }
    }
    return Math.max(0, unshared - shared);
}
function getComplexityLength(metrics) {
    const total = metrics.reduce((accum, metric) => {
        if (metric.children.length === 0) {
            return accum + metric.complexity;
        }
        const value = getComplexityLength(metric.children);
        return accum + value + metric.complexity;
    }, 0);
    return total;
}
function createProjectProgram(configPath, files) {
    const options = getCompilerOptions(configPath);
    const program = typescript.createProgram(files, options);
    if (!program) {
        throw new Error('Failed to create project program');
    }
    return program;
}
async function calculateCBO(directory, metricConfig, includes, excludes) {
    const configPath = getProjectConfigPath(directory);
    const files = await getSourceFiles(directory, includes, excludes);
    const program = createProjectProgram(configPath, files);
    const items = files
        .map((file) => {
        const total = getClassDependenciesLength(file, program);
        const label = getMetricLabel(total, metricConfig);
        return { total, label, value: file };
    });
    return items;
}
async function calculateRFC(directory, metricConfig, includes, excludes) {
    const files = await getSourceFiles(directory, includes, excludes);
    const items = files
        .map((file) => {
        const content = readFileContent(file);
        const total = getFunctionsLength(content);
        const label = getMetricLabel(total, metricConfig);
        return { total, label, value: file };
    });
    return items;
}
async function calculateLCOM(directory, metricConfig, includes, excludes) {
    const files = await getSourceFiles(directory, includes, excludes);
    const project = new tsMorph.Project();
    project.addSourceFilesAtPaths(files);
    const items = [];
    for (const sourceFile of project.getSourceFiles()) {
        for (const classDeclaration of sourceFile.getClasses()) {
            const className = classDeclaration.getName() ?? '[UnnamedClass]';
            const total = getCohesionLength(classDeclaration);
            const label = getMetricLabel(total, metricConfig);
            items.push({ total, label, value: className });
        }
    }
    return items;
}
async function calculateWMC(directory, metricConfig, includes, excludes) {
    const configPath = getProjectConfigPath(directory);
    const configContent = readFileContent(configPath);
    const target = getProjectTarget(configContent);
    const files = await getSourceFiles(directory, includes, excludes);
    const items = files.map((file) => {
        const { metrics } = tsmetricsCore.MetricsParser.getMetrics(file, tsmetricsCore.MetricsConfiguration, target);
        const total = getComplexityLength([metrics]);
        const label = getMetricLabel(total, metricConfig);
        return { total, label, value: file };
    });
    return items;
}

function readConfig() {
    const filePath = path.resolve(process.cwd(), '.artierc.json');
    const config = readFileContent(filePath);
    return JSON.parse(config);
}
function getEnableMetrics(config) {
    const enabled = [];
    for (const metric of Object.keys(config.options.metrics)) {
        const currentMetric = config.options.metrics[metric];
        if (currentMetric.enabled) {
            enabled.push(metric);
        }
    }
    return enabled;
}
function initConfig() {
    const filePath = path.resolve(process.cwd(), '.artierc.json');
    if (fs.existsSync(filePath)) {
        return console.log("⚠️  The file .artierc.json already exists on the current directory.");
    }
    const configContent = JSON.stringify(configTemplate, null, 2);
    fs.writeFileSync(filePath, configContent);
    console.log('✅ File .artierc.json created!');
}
function getMetricConfig(metricName) {
    const config = readConfig();
    const defaults = config.options.defaultThresholds;
    const metric = config.options.metrics[metricName.toLowerCase()];
    if (!metric) {
        throw new Error(`Metric ${metricName} not found.`);
    }
    if (!metric.enabled) {
        return { enabled: false };
    }
    return {
        enabled: metric.enabled,
        warning: metric.warning ?? defaults.warning,
        critical: metric.critical ?? defaults.critical,
        levels: metric.levels ?? defaults.levels,
    };
}
async function runLens(directory = process.cwd()) {
    const config = readConfig();
    const metrics = getEnableMetrics(config);
    const properties = {
        'cbo': calculateCBO,
        'rfc': calculateRFC,
        'lcom': calculateLCOM,
        'wmc': calculateWMC,
    };
    console.time('Total time');
    for (const metric of metrics) {
        const thresholds = getMetricConfig(metric);
        const result = await properties[metric](directory, thresholds, config.includes, config.excludes);
        const total = result.reduce((accum, item) => thresholds.levels.includes(item.label) ? accum + item.total : accum, 0);
        console.log(`${metric} - Total: ${total}`);
        for (const item of result) {
            if (thresholds.levels.includes(item.label)) {
                printMetric(`[${item.label}] ${item.value}: ${item.total}`, item.label);
            }
        }
    }
    console.timeEnd('Total time');
}
function showHelp() {
    console.log('Artie.JS\n');
    console.log('init - Initialize an .artierc.json file with default settings');
    console.log('run  - Run the lens for all metrics configured');
}
const main = async (args) => {
    const commands = {
        init: initConfig,
        run: runLens,
        help: showHelp,
    };
    const argument = args.slice(2);
    const parameter = argument[0];
    const directory = argument[1];
    if (parameter && parameter in commands) {
        await commands[parameter](directory);
    }
    else {
        console.log('⚠️  Invalid command');
    }
};
main(process.argv);

exports.getEnableMetrics = getEnableMetrics;
exports.getMetricConfig = getMetricConfig;
exports.initConfig = initConfig;
exports.readConfig = readConfig;
exports.runLens = runLens;
exports.showHelp = showHelp;
//# sourceMappingURL=artie.d.js.map
