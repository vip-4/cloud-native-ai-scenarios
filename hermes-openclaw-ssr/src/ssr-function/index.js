
const { Hermes } = require('hermes-engine');
const React = require('react');
const { renderToString } = require('react-dom/server');

exports.handler = async (event) => {
  // For simplicity, we ignore event and return a static SSR page
  const jsx = React.createElement('h1', null, 'Hello, Hermes + OpenClaw!');
  const html = renderToString(jsx);
  return {
    statusCode: 200,
    body: '<!DOCTYPE html>' + html
  };
};

