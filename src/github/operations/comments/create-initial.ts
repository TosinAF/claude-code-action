#!/usr/bin/env bun

/**
 * Create the initial tracking comment when Claude Code starts working
 * This comment shows the working status and includes a link to the job run
 */

import { appendFileSync } from "fs";
import {
  createJobRunLink,
  createCommentBody,
  createStickyCommentHeader,
} from "./common";
import {
  isPullRequestReviewCommentEvent,
  isPullRequestEvent,
  type ParsedGitHubContext,
} from "../../context";
import type { Octokit } from "@octokit/rest";

export async function createInitialComment(
  octokit: Octokit,
  context: ParsedGitHubContext,
) {
  const { owner, repo } = context.repository;
  const { useStickyComment, botName } = context.inputs;

  const jobRunLink = createJobRunLink(owner, repo, context.runId);
  // Add hidden header with bot name for sticky comment identification
  const initialBody = createCommentBody(
    jobRunLink,
    "",
    useStickyComment && botName ? botName : "",
  );

  try {
    let response;

    if (useStickyComment && botName && context.isPR && isPullRequestEvent(context)) {
      // Use pagination to fetch ALL comments (default is only 30 per page)
      const allComments = await octokit.paginate(octokit.rest.issues.listComments, {
        owner,
        repo,
        issue_number: context.entityNumber,
        per_page: 100,
      });

      // Find existing comment that matches this bot's sticky header
      const stickyHeader = createStickyCommentHeader(botName);
      console.log(`🔍 Searching for sticky header: "${stickyHeader}" among ${allComments.length} comments`);

      const existingComment = allComments.find((comment) => {
        // Only match comments with OUR bot's sticky header
        // This ensures each bot gets its own isolated comment
        const hasHeader = comment.body?.includes(stickyHeader);
        if (hasHeader) {
          console.log(`✅ Found matching comment ID: ${comment.id}`);
        }
        return hasHeader;
      });

      if (existingComment) {
        console.log(`📝 Updating existing comment ID: ${existingComment.id}`);
        response = await octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: existingComment.id,
          body: initialBody,
        });
      } else {
        console.log(`📝 No existing comment found, creating new one`);
        // Create new comment if no existing one found for this bot
        response = await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: context.entityNumber,
          body: initialBody,
        });
      }
    } else if (isPullRequestReviewCommentEvent(context)) {
      // Only use createReplyForReviewComment if it's a PR review comment AND we have a comment_id
      response = await octokit.rest.pulls.createReplyForReviewComment({
        owner,
        repo,
        pull_number: context.entityNumber,
        comment_id: context.payload.comment.id,
        body: initialBody,
      });
    } else {
      // For all other cases (issues, issue comments, or missing comment_id)
      response = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: context.entityNumber,
        body: initialBody,
      });
    }

    // Output the comment ID for downstream steps using GITHUB_OUTPUT
    const githubOutput = process.env.GITHUB_OUTPUT!;
    appendFileSync(githubOutput, `claude_comment_id=${response.data.id}\n`);
    console.log(`✅ Created initial comment with ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error("Error in initial comment:", error);

    // Always fall back to regular issue comment if anything fails
    try {
      const response = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: context.entityNumber,
        body: initialBody,
      });

      const githubOutput = process.env.GITHUB_OUTPUT!;
      appendFileSync(githubOutput, `claude_comment_id=${response.data.id}\n`);
      console.log(`✅ Created fallback comment with ID: ${response.data.id}`);
      return response.data;
    } catch (fallbackError) {
      console.error("Error creating fallback comment:", fallbackError);
      throw fallbackError;
    }
  }
}
