/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {LineToken} from 'vs/editor/common/editorCommon';

export class RenderLineInput {
	public _renderLineInputTrait: void;

	lineContent: string;
	tabSize: number;
	stopRenderingLineAfter: number;
	renderWhitespace: boolean;
	parts: LineToken[];

	constructor(
		lineContent: string,
		tabSize: number,
		stopRenderingLineAfter: number,
		renderWhitespace: boolean,
		parts: LineToken[]
	) {
		this.lineContent = lineContent;
		this.tabSize = tabSize;
		this.stopRenderingLineAfter = stopRenderingLineAfter;
		this.renderWhitespace = renderWhitespace;
		this.parts = parts;
	}
}

export interface IRenderLineOutput {
	charOffsetInPart: number[];
	lastRenderedPartIndex: number;
	output: string[];
}

const _space = ' '.charCodeAt(0);
const _tab = '\t'.charCodeAt(0);
const _lowerThan = '<'.charCodeAt(0);
const _greaterThan = '>'.charCodeAt(0);
const _ampersand = '&'.charCodeAt(0);
const _carriageReturn = '\r'.charCodeAt(0);
const _lineSeparator = '\u2028'.charCodeAt(0); //http://www.fileformat.info/info/unicode/char/2028/index.htm
const _bom = 65279;

export function renderLine(input:RenderLineInput): IRenderLineOutput {
	const lineText = input.lineContent;
	const lineTextLength = lineText.length;
	const tabSize = input.tabSize;
	const actualLineParts = input.parts;
	const renderWhitespace = input.renderWhitespace;
	const charBreakIndex = (input.stopRenderingLineAfter === -1 ? lineTextLength : input.stopRenderingLineAfter - 1);

	if (lineTextLength === 0) {
		return {
			charOffsetInPart: [],
			lastRenderedPartIndex: 0,
			// This is basically for IE's hit test to work
			output: ['<span><span>&nbsp;</span></span>']
		};
	}

	if (actualLineParts.length === 0) {
		throw new Error('Cannot render non empty line without line parts!');
	}

	return renderLineActual(lineText, lineTextLength, tabSize, actualLineParts.slice(0), renderWhitespace, charBreakIndex);
}

const WHITESPACE_TOKEN_TEST = /\bwhitespace\b/;
function isWhitespace(type:string): boolean {
	return WHITESPACE_TOKEN_TEST.test(type);
}

function renderLineActual(lineText:string, lineTextLength:number, tabSize:number, actualLineParts:LineToken[], renderWhitespace:boolean, charBreakIndex:number): IRenderLineOutput {
	lineTextLength = +lineTextLength;
	tabSize = +tabSize;
	charBreakIndex = +charBreakIndex;

	let charIndex = 0;
	let out: string[] = [];
	let charOffsetInPartArr: number[] = [];
	let charOffsetInPart = 0;
	let tabsCharDelta = 0;

	out.push('<span>');
	for (let partIndex = 0, partIndexLen = actualLineParts.length; partIndex < partIndexLen; partIndex++) {
		let part = actualLineParts[partIndex];

		out.push('<span class="token ');
		out.push(part.type);
		out.push('">');

		let partRendersWhitespace = false;
		if (renderWhitespace) {
			partRendersWhitespace = isWhitespace(part.type);
		}

		let toCharIndex = lineTextLength;
		if (partIndex + 1 < partIndexLen) {
			let nextPart = actualLineParts[partIndex + 1];
			toCharIndex = Math.min(lineTextLength, nextPart.startIndex);
		}

		charOffsetInPart = 0;
		for (; charIndex < toCharIndex; charIndex++) {
			charOffsetInPartArr[charIndex] = charOffsetInPart;
			let charCode = lineText.charCodeAt(charIndex);

			switch (charCode) {
				case _tab:
					let insertSpacesCount = tabSize - (charIndex + tabsCharDelta) % tabSize;
					tabsCharDelta += insertSpacesCount - 1;
					charOffsetInPart += insertSpacesCount - 1;
					if (insertSpacesCount > 0) {
						out.push(partRendersWhitespace ? '&rarr;' : '&nbsp;');
						insertSpacesCount--;
					}
					while (insertSpacesCount > 0) {
						out.push('&nbsp;');
						insertSpacesCount--;
					}
					break;

				case _space:
					out.push(partRendersWhitespace ? '&middot;' : '&nbsp;');
					break;

				case _lowerThan:
					out.push('&lt;');
					break;

				case _greaterThan:
					out.push('&gt;');
					break;

				case _ampersand:
					out.push('&amp;');
					break;

				case 0:
					out.push('&#00;');
					break;

				case _bom:
				case _lineSeparator:
					out.push('\ufffd');
					break;

				case _carriageReturn:
					// zero width space, because carriage return would introduce a line break
					out.push('&#8203');
					break;

				default:
					out.push(lineText.charAt(charIndex));
			}

			charOffsetInPart ++;

			if (charIndex >= charBreakIndex) {
				out.push('&hellip;</span></span>');
				charOffsetInPartArr[charOffsetInPartArr.length - 1]++;
				return {
					charOffsetInPart: charOffsetInPartArr,
					lastRenderedPartIndex: partIndex,
					output: out
				};
			}
		}
		out.push('</span>');
	}
	out.push('</span>');

	// When getting client rects for the last character, we will position the
	// text range at the end of the span, insteaf of at the beginning of next span
	charOffsetInPartArr.push(charOffsetInPart);

	return {
		charOffsetInPart: charOffsetInPartArr,
		lastRenderedPartIndex: actualLineParts.length - 1,
		output: out
	};
}
