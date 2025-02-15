import React from 'react';
import ReactMarkdown from 'react-markdown';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';

type ToSProps = {
    content: string;
};

export default function ToS({ content }: ToSProps) {
    return (
        <div className="max-w-3xl mx-auto p-4 flex flex-col">
            <ReactMarkdown remarkPlugins={[]} className="markdown">{content}</ReactMarkdown>

            <Link href="/" className='mx-auto w-fit text-center'>
                <button type="button" className="py-2 px-4 mx-auto text-center w-fit bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300">
                    Go back home
                </button>
            </Link>
        </div>
    );
}

export async function getStaticProps() {
    const filePath = path.join(process.cwd(), 'ToS.md'); // Adjust the path if necessary
    const content = fs.readFileSync(filePath, 'utf8');
    return {
        props: { content },
    };
}