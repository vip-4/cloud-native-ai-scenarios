#!/usr/bin/env node

const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const token = core.getInput('github-token', { required: true });
    const baseUrl = process.env.OPENAI_BASE_URL || 'http://localhost:3001/v1';
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      core.setFailed('OPENAI_API_KEY is required');
      return;
    }

    const context = github.context;
    const issue = context.payload.issue;

    if (!issue) {
      core.setFailed('This action only works on issues');
      return;
    }

    const title = issue.title;
    const body = issue.body || '';

    // 调用 AI 进行分类
    core.info('Analyzing issue with AI...');

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'kilo-auto',
        messages: [
          {
            role: 'system',
            content: 'You are an AI issue triage assistant. Analyze the following issue and provide: 1) Category (bug, feature, question, documentation, security), 2) Priority (critical, high, medium, low), 3) Suggested labels, 4) Estimated complexity, 5) Recommended assignee type. Format as JSON.',
          },
          {
            role: 'user',
            content: `Issue Title: ${title}\n\nIssue Body:\n${body}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const aiResult = await aiResponse.json();
    const triageContent = aiResult.choices?.[0]?.message?.content || '{}';

    let triage;
    try {
      triage = JSON.parse(triageContent);
    } catch (e) {
      core.warning(`Failed to parse triage response: ${triageContent}`);
      triage = {};
    }

    // 应用标签
    const octokit = github.getOctokit(token);
    const labels = ['ai-triaged'];

    if (triage.category) labels.push(triage.category);
    if (triage.priority) labels.push(`priority-${triage.priority}`);
    if (triage.labels && Array.isArray(triage.labels)) {
      labels.push(...triage.labels);
    }

    await octok.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issue.number,
      labels: [...new Set(labels)], // 去重
    });

    // 添加评论
    const comment = `## 🤖 AI Triage Analysis\n\n**Category:** ${triage.category || 'unknown'}\n**Priority:** ${triage.priority || 'medium'}\n**Complexity:** ${triage.complexity || 'medium'}\n**Suggested Assignee Type:** ${triage.recommended_assignee_type || 'any'}\n\n*Analysis by AI • Model: kilo-auto*`;

    await octok.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issue.number,
      body: comment,
    });

    core.setOutput('category', triage.category || 'unknown');
    core.setOutput('priority', triage.priority || 'medium');
    core.setOutput('labels', JSON.stringify(labels));
    core.info('Issue triage completed successfully');
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
