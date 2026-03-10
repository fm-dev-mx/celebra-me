import React from 'react';

interface Props {
	selector: string;
}

export const HeaderBehavior: React.FC<Props> = ({ selector }) => {
	void selector;
	return null;
};

export default HeaderBehavior;
