'use strict';

const jsnx = require('jsnetworkx');
const _ = require('lodash');
const stopwords = require('stopwords-en');

let G = new jsnx.Graph();
const color = d3.scale.category20();
const linearColorScale = d3.scale.linear().domain([0, 100]).range(["white", "black"]);


G.addNodesFrom([1,2,3,4], {freq:8});
G.addNodesFrom([5,6,7], {freq:5});
G.addNodesFrom([8,9,10,11], {freq:3});

// G.addPath([1,2,5,6,7,8,11]);
G.addEdgesFrom([[1,3],[1,4],[3,4],[2,3],[2,4],[8,9],[8,10],[9,10],[11,10],[11,9]]);

/*
G.addWeightedEdgesFrom([[2,3,10]]);
G.addStar([3,4,5,6], {weight: 5});
G.addStar([2,1,0,-1], {weight: 3});
*/

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
// https://stackoverflow.com/questions/37538093/reading-multiple-files-synchronously-in-javascript-using-filereader


function readTextData(file, encoding) {
  let p = new Promise(function(resolve, reject) {
    // Create reader
    let reader = new FileReader();
    // set-up callbacks
    reader.onload = function() {
      // console.log(reader.result);
      //add to Map here
      document.getElementById('processingUpdates').innerHTML = document.getElementById('processingUpdates').innerHTML + file.name+' (Done)<br>';
      resolve(reader.result);
    };
    reader.onerror = function(error){
      reject(error);
    };
    // Execute Read File
    reader.readAsText(file, encoding);
  });
  // return promise
  return p;
}

function drawG() {
  jsnx.draw(G, {
    element: '#canvas',
    weighted: true,
    withLabels: true,
    layoutAttr: {
      charge: document.getElementById('chargeSlider').value,
      linkDistance: document.getElementById('linkSlider').value,
      friction: 0.5,
      gravity: 0.05
    },
    nodeStyle: {
      fill: color(0),
      stroke: 'none'
    },
    nodeAttr: {
      r : function(d) {
        if (!d.data.freq) {
          return 0;
        }
        if (d.data.freq < 3) {
          return 3;
        } else {
          return 3 + d.data.freq / 30;
        }
      }
    },
    edgeAttr: {},
    edgeStyle: {
      'stroke-width': 5,
      fill: function(d) {
        return linearColorScale(d.data.weight);
      },
      "opacity": 0.5
    },
    labelStyle: {
      fill: 'black'
    },
    stickyDrag: true
  },
  true);
}

drawG();

// Set listeners
const reportsBtn = document.getElementById('reportsBtn');
reportsBtn.addEventListener('click', analyseReports, false);

const chargeSlider = document.getElementById('chargeSlider');
chargeSlider.addEventListener('change', chargeChanged, false);

const linkSlider = document.getElementById('linkSlider');
linkSlider.addEventListener('change', linkDistanceChanged, false);

// Functions
function chargeChanged() {
  drawG();
  document.getElementById('chargeValue').innerHTML = document.getElementById('chargeSlider').value;
}

function linkDistanceChanged(event) {
  drawG();
  document.getElementById('linkValue').innerHTML = document.getElementById('linkSlider').value;
}



function analyseReports() {
  document.getElementById('processingUpdates').innerHTML = 'Processing<br>';
  // Retrieve encoding
  let encoding = document.getElementById('encoding').value;
  console.log('Encoding: '+encoding);
  // Extract text from the files
  let fileData = [];
  for (let i = 0; i < document.getElementById('reports').files.length; i++) {
    fileData.push(readTextData(document.getElementById('reports').files[i], encoding));
  }
  // Wait for all the asynchronous calls to come back
  Promise.all(fileData).then(function(reports) {
    // Generate terms list
    let terms = [];
    for (let i = 0; i < reports.length; i++) {
      reports[i] = reports[i].toLowerCase();
      // extract the terms
      terms = terms.concat(reports[i].match(/\S+/g));
    }
    //
    console.log('Number of terms: '+terms.length);
    //const cutoff = 0.001 * terms.length;
    const cutoff = document.getElementById('cutoff').value;
    console.log('Cutoff: '+cutoff);
    // Create the bigrams and grams of interest
    let oneGrams = {};
    // temporary store of grams of interest
    let tempGrams = _.countBy(terms);
    // iterate through and select grams to keep
    for (let key in tempGrams) {
      // if it is a word
      if (/^[a-zA-Z]+$/.test(key) && key.length > 2 && tempGrams[key] > cutoff && !stopwords.includes(key)) {
        oneGrams[key] = tempGrams[key];
      }
    }
    //console.log(oneGrams);
    // reset tempgrams
    tempGrams = [];
    // iterate through terms and create potential bigrams from the terms
    for (let i = 0; i-2 < terms.length; i++) {
      if (terms[i] && terms[i+1]) {
        if (/^[a-zA-Z]+$/.test(terms[i]) && terms[i].length > 1 && !stopwords.includes(terms[i]) && /^[a-zA-Z]+$/.test(terms[i+1]) && terms[i+1].length > 1 && !stopwords.includes(terms[i+1])) {
          tempGrams.push(terms[i]+' '+terms[i+1]);
        }
      }
    }
    // count the number of appearences
    tempGrams = _.countBy(tempGrams);
    // now go through counts and select the bigrams of interest
    let biGrams = {};
    for (let key in tempGrams) {
      if (tempGrams[key] > cutoff) {
        biGrams[key] = tempGrams[key];
      }
    }
    //console.log(biGrams);

    // Creating a gram set with unique ids
    let gramSet = {};
    let n = 0;
    let tempId = '';
    for (let key in biGrams) {
      tempId = 'gram_'+n;
      gramSet[tempId] = key;
      n++;
    }
    for (let key in oneGrams) {
      n++;
      tempId = 'gram_'+n;
      gramSet[tempId] = key;
    }
    console.log(gramSet);
    // replace terms with gramset unique ids
    for (let key in gramSet) {
      for (let i = 0; i < reports.length; i++) {
        reports[i] = _.replace(reports[i], new RegExp(gramSet[key], "g"), key+' ');
      }
    }

    // now the terms have be id'ed we can extract the list for each report
    const re = new RegExp('gram_([0-9]+)', 'g');
    let gramLists = [];
    for (let i = 0; i < reports.length; i++) {
      gramLists.push(reports[i].match(re));
    }

    // count frequency of terms and count nodes
    let concatGramList = [];
    for (let gramList of gramLists) {
      // console.log(gramList);
      for (let idx in gramList) {
        concatGramList.push(gramList[idx]);
      }
    }

    // Start new network
    G = new jsnx.Graph();
    let counts = _.countBy(concatGramList);
    for (let key in gramSet) {
      G.addNode(gramSet[key], {freq: counts[key]});
    }

    //console.log(G.nodes(true));

    // Create the Edges (To Do: Wrap in a promise so to not slow down the page)
    let edges = {};
    let nodes = [];
    let key = '';
    // now for the edges
    for (let gramList of gramLists) {
      if (gramList) {
        for (let i = 0; i < gramList.length - 3; i++) {
          for (let j = 1; j < 3; j++) {
            nodes = [ gramSet[gramList[i]], gramSet[gramList[i+j]] ];
            nodes = nodes.sort();
            key = nodes[0]+'_'+nodes[1];
            if (key in edges) {
              edges[key].freq = edges[key].freq + 1;
            } else {
              edges[key] = {
                to : nodes[1],
                from : nodes[0],
                freq : 1
              };
            }
          }
        }
      }
    }

    for (let key in edges) {
      // edge pruning
      if (edges[key].freq > document.getElementById('cocutoff').value) {
        G.addEdge(edges[key].from, edges[key].to, {freq: edges[key].freq, weight: edges[key].freq});
      }
    }

    // Prune nodes
    nodes = G.nodes();
    for (let n of nodes) {
      if (jsnx.degree(G, n) == 0) {
        G.removeNode(n);
      }
    }

    drawG();

  });
}
