// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Link, Text, View} from '@react-pdf/renderer';

import {formatText} from 'src/webapp_globals';

interface MarkdownTextProps {
    content: string;
    baseStyle?: Record<string, any>;
}

// Markdown renderer for PDF that uses Mattermost's formatText utility
// Converts HTML output to PDF components for @react-pdf/renderer
export const MarkdownText = ({content, baseStyle = {}}: MarkdownTextProps) => {
    if (!content) {
        return <Text style={baseStyle} />;
    }

    // Use formatText to convert markdown to HTML
    const formattedHtml = formatText(content, {
        singleline: false,
        mentionHighlight: false,
        atMentions: false,
    });

    // Convert HTML to PDF components (simplified for common cases)
    const pdfComponents = htmlToPdfComponents(formattedHtml, baseStyle);

    return <>{pdfComponents}</>;
};

// Convert HTML string to PDF components
// Handles: bold, italic, code, links, line breaks, code blocks
const htmlToPdfComponents = (html: string, baseStyle: Record<string, any>): React.ReactNode[] => {
    // Strip HTML tags and extract text with basic formatting
    const components: React.ReactNode[] = [];

    // Handle code blocks (pre tags)
    const codeBlockRegex = /<pre[^>]*>([\s\S]*?)<\/pre>/g;
    const codeBlocks: string[] = [];
    const contentWithPlaceholders = html.replace(codeBlockRegex, (_, code) => {
        const cleanCode = code
            .replace(/<[^>]+>/g, '') // Remove inner tags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');
        codeBlocks.push(cleanCode);
        return `__CODEBLOCK_${codeBlocks.length - 1}__`;
    });

    // Split by lines
    const lines = contentWithPlaceholders.split(/\n|<br\s*\/?>/);

    lines.forEach((line, lineIndex) => {
        // Check for code block placeholder
        const codeBlockMatch = line.match(/__CODEBLOCK_(\d+)__/);
        if (codeBlockMatch) {
            const code = codeBlocks[parseInt(codeBlockMatch[1], 10)];
            components.push(
                <View
                    key={`codeblock-${lineIndex}`}
                    style={{
                        backgroundColor: '#f4f4f4',
                        padding: 8,
                        marginVertical: 4,
                        borderRadius: 3,
                        borderLeft: '2px solid #ccc',
                    }}
                >
                    <Text style={{fontSize: 8, fontFamily: 'Courier', color: '#333'}}>
                        {code}
                    </Text>
                </View>
            );
            return;
        }

        // Parse inline elements
        const inlineElements = parseInlineHtml(line);

        if (inlineElements.length > 0) {
            components.push(
                <Text
                    key={`line-${lineIndex}`}
                    style={baseStyle}
                >
                    {inlineElements}
                    {lineIndex < lines.length - 1 && '\n'}
                </Text>
            );
        }
    });

    return components;
};

// Parse inline HTML to PDF Text components
const parseInlineHtml = (html: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];

    // Regex to match HTML tags
    const tagRegex = /<(\w+)[^>]*>(.*?)<\/\1>|([^<]+)/g;
    let match;
    let key = 0;

    while ((match = tagRegex.exec(html)) !== null) {
        const tag = match[1];
        const content = match[2] || match[3];

        if (!content) {
            continue;
        }

        // Decode HTML entities
        const decodedContent = content
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/<[^>]+>/g, ''); // Strip remaining tags

        if (!tag) {
            // Plain text
            elements.push(decodedContent);
        } else if (tag === 'strong' || tag === 'b') {
            elements.push(
                <Text
                    key={key++}
                    style={{fontWeight: 'bold'}}
                >
                    {decodedContent}
                </Text>
            );
        } else if (tag === 'em' || tag === 'i') {
            elements.push(
                <Text
                    key={key++}
                    style={{fontStyle: 'italic'}}
                >
                    {decodedContent}
                </Text>
            );
        } else if (tag === 'code') {
            elements.push(
                <Text
                    key={key++}
                    style={{
                        fontFamily: 'Courier',
                        fontSize: 8,
                        backgroundColor: '#f4f4f4',
                        padding: '1 3',
                        color: '#e01e5a',
                    }}
                >
                    {decodedContent}
                </Text>
            );
        } else if (tag === 'a') {
            const hrefMatch = html.match(/href=["']([^"']+)["']/);
            const href = hrefMatch ? hrefMatch[1] : '#';
            elements.push(
                <Link
                    key={key++}
                    src={href}
                    style={{color: '#1c58d9', textDecoration: 'underline'}}
                >
                    {decodedContent}
                </Link>
            );
        } else {
            // Unknown tag, just add the content
            elements.push(decodedContent);
        }
    }

    return elements;
};

export default MarkdownText;
